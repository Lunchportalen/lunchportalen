-- PHASE 17MENU.2D — Persist exact_numerator / price_version / reversal_of on commission write path.
-- Staging-first. Protected Golden Path Impact: billing ledger only (not lp_order_set).

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION private.lp_billing_post_delivered_commission_unchecked(
  p_order_id uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'order delivered'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private, extensions
AS $$
DECLARE
  v_snapshot record;
  v_inserted integer := 0;
  v_rows integer := 0;
  v_exact bigint;
  v_price_version text;
  v_package text;
  v_checksum text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = p_order_id AND o.status = 'DELIVERED'::public.order_status
  ) THEN
    RAISE EXCEPTION 'ORDER_NOT_DELIVERED';
  END IF;

  -- Snapshots may outlive order_items after cancel; do not require live items for earn post.
  FOR v_snapshot IN
    SELECT s.*
    FROM public.order_line_commercial_snapshots s
    WHERE s.order_id = p_order_id
    ORDER BY s.order_line_id
  LOOP
    v_exact := (v_snapshot.line_subtotal_ex_tax_minor::bigint * v_snapshot.commission_rate_bps::bigint);
    v_price_version := coalesce(
      nullif(trim(to_jsonb(v_snapshot)->>'price_version'), ''),
      nullif(trim(to_jsonb(v_snapshot)->>'provider_price_rule_id'), ''),
      concat('snap:', v_snapshot.order_line_id::text)
    );
    v_package := nullif(trim(to_jsonb(v_snapshot)->>'package_key'), '');
    v_checksum := encode(extensions.digest(convert_to(concat_ws('|',
      v_snapshot.order_id::text,
      v_snapshot.order_line_id::text,
      v_snapshot.line_subtotal_ex_tax_minor::text,
      v_snapshot.commission_rate_bps::text,
      v_exact::text
    ), 'UTF8'), 'sha256'), 'hex');

    INSERT INTO public.commission_ledger (
      provider_id, organization_id, order_id, order_line_id, event_type,
      commission_rule_id, commission_rate_bps, market_id, country_code, tax_country_code,
      currency, commission_basis_amount_minor, commission_amount_exact, billing_period,
      idempotency_key, reason, created_by,
      exact_numerator, denominator, price_version, package_key, source_event, calculation_checksum
    ) VALUES (
      v_snapshot.provider_id, v_snapshot.organization_id, v_snapshot.order_id, v_snapshot.order_line_id,
      'ORDER_COMPLETED', v_snapshot.commission_rule_id, v_snapshot.commission_rate_bps,
      v_snapshot.market_id, v_snapshot.country_code, v_snapshot.tax_country_code, v_snapshot.currency,
      v_snapshot.line_subtotal_ex_tax_minor,
      (v_snapshot.line_subtotal_ex_tax_minor::numeric * v_snapshot.commission_rate_bps::numeric) / 10000,
      private.lp_billing_effective_period(
        v_snapshot.provider_id, v_snapshot.currency,
        (SELECT to_char(v_snapshot.ordered_at AT TIME ZONE obp.billing_timezone, 'YYYY-MM')
         FROM public.organization_billing_profiles obp
         WHERE obp.organization_id = v_snapshot.provider_id)
      ),
      concat('commission:ORDER_COMPLETED:', v_snapshot.order_id, ':', v_snapshot.order_line_id),
      p_reason, p_actor_user_id,
      v_exact, 10000, v_price_version, v_package, 'ORDER_COMPLETED', v_checksum
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END LOOP;

  RETURN v_inserted;
END;
$$;

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
  v_exact bigint;
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'COMMISSION_CORRECTION_FORBIDDEN';
  END IF;
  IF p_order_id IS NULL THEN RAISE EXCEPTION 'ORDER_ID_REQUIRED'; END IF;
  IF v_event_type NOT IN ('ORDER_CANCELLED', 'ORDER_REFUNDED', 'ORDER_CORRECTED', 'CREDIT_NOTE') THEN
    RAISE EXCEPTION 'NEGATIVE_COMMISSION_EVENT_UNSUPPORTED';
  END IF;
  IF v_reason IS NULL THEN RAISE EXCEPTION 'NEGATIVE_COMMISSION_REASON_REQUIRED'; END IF;
  IF v_event_type IN ('ORDER_REFUNDED', 'ORDER_CORRECTED', 'CREDIT_NOTE') AND v_reference_id IS NULL THEN
    RAISE EXCEPTION 'NEGATIVE_COMMISSION_REFERENCE_REQUIRED';
  END IF;

  SELECT cl.provider_id INTO v_provider_id
  FROM public.commission_ledger cl
  WHERE cl.order_id = p_order_id AND cl.event_type = 'ORDER_COMPLETED'
  ORDER BY cl.created_at ASC LIMIT 1;

  IF v_provider_id IS NULL THEN
    SELECT o.provider_id INTO v_provider_id FROM public.orders o WHERE o.id = p_order_id;
    PERFORM private.lp_billing_record_ledger_skip_unchecked(
      v_provider_id, p_order_id, v_event_type, v_reason, v_reference_id
    );
    RETURN 0;
  END IF;

  FOR v_completed IN
    SELECT cl.* FROM public.commission_ledger cl
    WHERE cl.order_id = p_order_id AND cl.event_type = 'ORDER_COMPLETED'
    ORDER BY cl.order_line_id
  LOOP
    v_idempotency_key := CASE
      WHEN v_event_type = 'ORDER_CANCELLED' THEN concat('commission:ORDER_CANCELLED:', v_completed.order_id, ':', v_completed.order_line_id)
      WHEN v_event_type = 'ORDER_REFUNDED' THEN concat('commission:ORDER_REFUNDED:', v_completed.order_id, ':', v_completed.order_line_id, ':', v_reference_id)
      WHEN v_event_type = 'ORDER_CORRECTED' THEN concat('commission:ORDER_CORRECTED:', v_completed.order_id, ':', v_completed.order_line_id, ':', v_reference_id)
      WHEN v_event_type = 'CREDIT_NOTE' THEN concat('commission:CREDIT_NOTE:', v_reference_id, ':', v_completed.order_id, ':', v_completed.order_line_id)
      ELSE NULL
    END;

    v_exact := coalesce(
      -abs(v_completed.exact_numerator),
      -(abs(v_completed.commission_basis_amount_minor)::bigint * v_completed.commission_rate_bps::bigint)
    );

    INSERT INTO public.commission_ledger (
      provider_id, organization_id, order_id, order_line_id, event_type,
      commission_rule_id, commission_rate_bps, market_id, country_code, tax_country_code,
      currency, commission_basis_amount_minor, commission_amount_exact, billing_period,
      idempotency_key, reason, created_by,
      exact_numerator, denominator, price_version, package_key, source_event,
      reversal_of, calculation_checksum
    ) VALUES (
      v_completed.provider_id, v_completed.organization_id, v_completed.order_id, v_completed.order_line_id,
      v_event_type, v_completed.commission_rule_id, v_completed.commission_rate_bps,
      v_completed.market_id, v_completed.country_code, v_completed.tax_country_code, v_completed.currency,
      -abs(v_completed.commission_basis_amount_minor),
      -abs(v_completed.commission_amount_exact),
      private.lp_billing_effective_period(v_completed.provider_id, v_completed.currency, v_completed.billing_period),
      v_idempotency_key, v_reason, auth.uid(),
      v_exact, 10000, v_completed.price_version, v_completed.package_key, v_event_type,
      v_completed.id,
      coalesce(v_completed.calculation_checksum, concat('rev:', v_completed.id::text))
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END LOOP;

  RETURN v_inserted;
END;
$$;
