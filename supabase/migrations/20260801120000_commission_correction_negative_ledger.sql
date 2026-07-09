-- Global Billing Engine phase: correction/refund policy + negative commission ledger events.
--
-- Scope:
-- - Service/platform-admin RPC for negative commission ledger events based only on
--   existing positive ORDER_COMPLETED ledger rows.
-- - Idempotent diagnostic event when correction is attempted without completed ledger.
-- - No automatic cancel hook, no payment refund, no invoice credit note sending, no UI.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Policy comments (database-local contract)
-- ---------------------------------------------------------------------------
COMMENT ON TABLE public.commission_ledger IS
  'Append-only commission ledger. ORDER_COMPLETED rows are never mutated or deleted; cancellations, refunds, corrections, manual adjustments, and credit notes are new ledger events. Negative order corrections must be based on existing ORDER_COMPLETED ledger rows, never current menu/provider prices.';

-- ---------------------------------------------------------------------------
-- 2) Shared helper: diagnostic when correction cannot be posted
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lp_billing_record_ledger_skip_unchecked(
  p_provider_id uuid,
  p_order_id uuid,
  p_event_type text,
  p_reason text,
  p_reference_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
BEGIN
  INSERT INTO public.billing_readiness_events (
    provider_id,
    order_id,
    order_line_id,
    event_type,
    missing_requirements,
    detail,
    idempotency_key
  )
  VALUES (
    p_provider_id,
    p_order_id,
    NULL,
    'LEDGER_SKIPPED',
    ARRAY['completed_ledger_missing']::text[],
    jsonb_build_object(
      'commission_event_type', p_event_type,
      'reason', left(coalesce(p_reason, ''), 500),
      'reference_id', p_reference_id
    ),
    concat(
      'billing-readiness:LEDGER_SKIPPED:',
      p_event_type,
      ':',
      p_order_id,
      ':',
      coalesce(nullif(trim(p_reference_id), ''), 'none')
    )
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3) Negative ledger RPC (service/platform-admin only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_billing_post_negative_commission_for_order(
  p_order_id uuid,
  p_event_type text,
  p_reason text,
  p_reference_id text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_event_type text := upper(trim(coalesce(p_event_type, '')));
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_reference_id text := nullif(trim(coalesce(p_reference_id, '')), '');
  v_completed record;
  v_inserted integer := 0;
  v_rows integer := 0;
  v_provider_id uuid;
  v_idempotency_key text;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'COMMISSION_CORRECTION_FORBIDDEN';
  END IF;

  IF p_order_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_ID_REQUIRED';
  END IF;

  IF v_event_type NOT IN ('ORDER_CANCELLED', 'ORDER_REFUNDED', 'ORDER_CORRECTED', 'CREDIT_NOTE') THEN
    RAISE EXCEPTION 'NEGATIVE_COMMISSION_EVENT_UNSUPPORTED';
  END IF;

  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'NEGATIVE_COMMISSION_REASON_REQUIRED';
  END IF;

  IF v_event_type IN ('ORDER_REFUNDED', 'ORDER_CORRECTED', 'CREDIT_NOTE')
     AND v_reference_id IS NULL THEN
    RAISE EXCEPTION 'NEGATIVE_COMMISSION_REFERENCE_REQUIRED';
  END IF;

  SELECT cl.provider_id
  INTO v_provider_id
  FROM public.commission_ledger cl
  WHERE cl.order_id = p_order_id
    AND cl.event_type = 'ORDER_COMPLETED'
  ORDER BY cl.created_at ASC
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    SELECT o.provider_id INTO v_provider_id
    FROM public.orders o
    WHERE o.id = p_order_id;

    PERFORM private.lp_billing_record_ledger_skip_unchecked(
      v_provider_id,
      p_order_id,
      v_event_type,
      v_reason,
      v_reference_id
    );

    RETURN 0;
  END IF;

  FOR v_completed IN
    SELECT cl.*
    FROM public.commission_ledger cl
    WHERE cl.order_id = p_order_id
      AND cl.event_type = 'ORDER_COMPLETED'
    ORDER BY cl.order_line_id
  LOOP
    v_idempotency_key := CASE
      WHEN v_event_type = 'ORDER_CANCELLED' THEN
        concat('commission:ORDER_CANCELLED:', v_completed.order_id, ':', v_completed.order_line_id)
      WHEN v_event_type = 'ORDER_REFUNDED' THEN
        concat('commission:ORDER_REFUNDED:', v_completed.order_id, ':', v_completed.order_line_id, ':', v_reference_id)
      WHEN v_event_type = 'ORDER_CORRECTED' THEN
        concat('commission:ORDER_CORRECTED:', v_completed.order_id, ':', v_completed.order_line_id, ':', v_reference_id)
      WHEN v_event_type = 'CREDIT_NOTE' THEN
        concat('commission:CREDIT_NOTE:', v_reference_id, ':', v_completed.order_id, ':', v_completed.order_line_id)
      ELSE
        NULL
    END;

    INSERT INTO public.commission_ledger (
      provider_id,
      organization_id,
      order_id,
      order_line_id,
      event_type,
      commission_rule_id,
      commission_rate_bps,
      market_id,
      country_code,
      tax_country_code,
      currency,
      commission_basis_amount_minor,
      commission_amount_exact,
      billing_period,
      idempotency_key,
      reason,
      created_by
    )
    VALUES (
      v_completed.provider_id,
      v_completed.organization_id,
      v_completed.order_id,
      v_completed.order_line_id,
      v_event_type,
      v_completed.commission_rule_id,
      v_completed.commission_rate_bps,
      v_completed.market_id,
      v_completed.country_code,
      v_completed.tax_country_code,
      v_completed.currency,
      -abs(v_completed.commission_basis_amount_minor),
      -abs(v_completed.commission_amount_exact),
      v_completed.billing_period,
      v_idempotency_key,
      v_reason,
      auth.uid()
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END LOOP;

  IF v_inserted > 0 THEN
    INSERT INTO public.billing_audit_log (
      organization_id,
      actor_user_id,
      action,
      after_json,
      reason
    )
    VALUES (
      v_provider_id,
      auth.uid(),
      'commission_ledger.negative_event_posted',
      jsonb_build_object(
        'order_id', p_order_id,
        'event_type', v_event_type,
        'reference_id', v_reference_id,
        'inserted', v_inserted
      ),
      v_reason
    );
  END IF;

  RETURN v_inserted;
END;
$$;

COMMENT ON FUNCTION public.lp_billing_post_negative_commission_for_order(uuid, text, text, text) IS
  'Posts idempotent negative commission ledger events from existing ORDER_COMPLETED ledger rows only. No menu/provider-price lookup and no payment refund.';

GRANT EXECUTE ON FUNCTION public.lp_billing_post_negative_commission_for_order(uuid, text, text, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION private.lp_billing_record_ledger_skip_unchecked(uuid, uuid, text, text, text)
  FROM PUBLIC, anon, authenticated;

COMMIT;
