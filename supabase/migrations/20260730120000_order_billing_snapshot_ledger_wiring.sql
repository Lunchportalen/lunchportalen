-- Global Billing Engine phase: order-line commercial snapshots + delivered commission ledger.
--
-- Protected Golden Path Impact:
-- - Adds a narrow AFTER INSERT trigger on order_items to snapshot the actual ordered line.
-- - Replaces provider/batch status RPC bodies only to call the same idempotent billing helper
--   after a successful transition to DELIVERED.
-- - Does not change order pricing, menu matching, cutoff semantics, provider scoping,
--   payment provider behavior, invoices, UI, or lp_order_set business logic.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Extend commercial snapshots with full line totals + explicit idempotency
-- ---------------------------------------------------------------------------
ALTER TABLE public.order_line_commercial_snapshots
  ADD COLUMN IF NOT EXISTS line_subtotal_ex_tax_minor integer,
  ADD COLUMN IF NOT EXISTS line_tax_minor integer,
  ADD COLUMN IF NOT EXISTS line_total_inc_tax_minor integer,
  ADD COLUMN IF NOT EXISTS idempotency_key text;

UPDATE public.order_line_commercial_snapshots
SET
  line_subtotal_ex_tax_minor = coalesce(line_subtotal_ex_tax_minor, commission_basis_amount_minor),
  line_tax_minor = coalesce(line_tax_minor, tax_amount_minor * greatest(quantity, 1)),
  line_total_inc_tax_minor = coalesce(line_total_inc_tax_minor, unit_price_gross_minor * greatest(quantity, 1)),
  idempotency_key = coalesce(idempotency_key, concat('order-line-snapshot:', order_id, ':', order_line_id))
WHERE line_subtotal_ex_tax_minor IS NULL
   OR line_tax_minor IS NULL
   OR line_total_inc_tax_minor IS NULL
   OR idempotency_key IS NULL;

ALTER TABLE public.order_line_commercial_snapshots
  ALTER COLUMN line_subtotal_ex_tax_minor SET NOT NULL,
  ALTER COLUMN line_tax_minor SET NOT NULL,
  ALTER COLUMN line_total_inc_tax_minor SET NOT NULL,
  ALTER COLUMN idempotency_key SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_line_snapshots_idempotency_key_uniq'
  ) THEN
    ALTER TABLE public.order_line_commercial_snapshots
      ADD CONSTRAINT order_line_snapshots_idempotency_key_uniq UNIQUE (idempotency_key);
  END IF;
END
$$;

-- Backfill billing profiles only where provider settings already provide explicit market truth.
-- No fallback: providers without explicit settings/market remain without billing profile.
INSERT INTO public.organization_billing_profiles (
  organization_id,
  market_id,
  legal_name,
  legal_country_code,
  tax_country_code,
  billing_currency,
  billing_timezone,
  billing_status
)
SELECT
  p.id,
  m.id,
  p.name,
  m.country_code,
  m.tax_country_code,
  ps.default_currency,
  ps.timezone,
  'setup_required'
FROM public.providers p
JOIN public.organizations o
  ON o.id = p.id
 AND o.type = 'provider'::public.org_type
JOIN public.provider_settings ps
  ON ps.provider_id = p.id
JOIN public.markets m
  ON m.locale = ps.locale
 AND m.country_code = ps.default_country_code
 AND m.default_currency = ps.default_currency
WHERE p.deleted_at IS NULL
ON CONFLICT (organization_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 2) Shared internal snapshot helper (actual order_items snapshot only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lp_billing_create_order_line_snapshot_unchecked(
  p_order_line_id uuid
)
RETURNS public.order_line_commercial_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_rule public.commission_rules;
  v_row public.order_line_commercial_snapshots;
BEGIN
  SELECT *
  INTO v_rule
  FROM public.commission_rules
  WHERE code = 'LP_GLOBAL_5P'
    AND version = 1
    AND active_to IS NULL
  LIMIT 1;

  IF v_rule.id IS NULL THEN
    RAISE EXCEPTION 'COMMISSION_RULE_NOT_FOUND';
  END IF;

  INSERT INTO public.order_line_commercial_snapshots (
    order_line_id,
    order_id,
    provider_id,
    organization_id,
    market_id,
    locale,
    country_code,
    tax_country_code,
    menu_item_id,
    title_snapshot,
    quantity,
    unit_price_gross_minor,
    unit_price_net_minor,
    tax_amount_minor,
    tax_rate_snapshot,
    tax_included,
    currency,
    ordered_at,
    commission_rule_id,
    commission_rate_bps,
    commission_basis_amount_minor,
    line_subtotal_ex_tax_minor,
    line_tax_minor,
    line_total_inc_tax_minor,
    idempotency_key
  )
  SELECT
    oi.id,
    o.id,
    o.provider_id,
    o.provider_id,
    obp.market_id,
    m.locale,
    m.country_code,
    m.tax_country_code,
    oi.product_id,
    oi.product_name_snapshot,
    oi.quantity,
    round(oi.line_total_cents_inc_vat::numeric / greatest(oi.quantity, 1))::integer,
    oi.unit_price_cents_ex_vat,
    round(oi.line_vat_cents::numeric / greatest(oi.quantity, 1))::integer,
    oi.vat_rate_snapshot,
    false,
    coalesce(nullif(o.currency_code, ''), obp.billing_currency),
    o.created_at,
    v_rule.id,
    v_rule.rate_bps,
    oi.line_subtotal_cents_ex_vat,
    oi.line_subtotal_cents_ex_vat,
    oi.line_vat_cents,
    oi.line_total_cents_inc_vat,
    concat('order-line-snapshot:', o.id, ':', oi.id)
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.organization_billing_profiles obp ON obp.organization_id = o.provider_id
  JOIN public.markets m ON m.id = obp.market_id
  WHERE oi.id = p_order_line_id
  ON CONFLICT (order_line_id) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.order_line_id IS NULL THEN
    SELECT *
    INTO v_row
    FROM public.order_line_commercial_snapshots
    WHERE order_line_id = p_order_line_id;
  END IF;

  IF v_row.order_line_id IS NULL THEN
    RAISE EXCEPTION 'ORDER_LINE_NOT_SNAPSHOTABLE';
  END IF;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION private.lp_billing_snapshot_order_unchecked(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_item record;
  v_count integer := 0;
BEGIN
  FOR v_item IN
    SELECT oi.id
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
    ORDER BY oi.id
  LOOP
    PERFORM private.lp_billing_create_order_line_snapshot_unchecked(v_item.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_create_order_line_snapshot(
  p_order_line_id uuid,
  p_market_id uuid DEFAULT NULL
)
RETURNS public.order_line_commercial_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
BEGIN
  IF p_market_id IS NOT NULL THEN
    RAISE EXCEPTION 'EXPLICIT_MARKET_OVERRIDE_NOT_SUPPORTED_FOR_ORDER_SNAPSHOT';
  END IF;

  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'ORDER_LINE_SNAPSHOT_FORBIDDEN';
  END IF;

  RETURN private.lp_billing_create_order_line_snapshot_unchecked(p_order_line_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_billing_snapshot_order_item()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
BEGIN
  BEGIN
    PERFORM private.lp_billing_create_order_line_snapshot_unchecked(NEW.id);
  EXCEPTION
    WHEN OTHERS THEN
      -- Do not break the protected order path for providers not yet billing-ready.
      -- Ledger posting remains fail-closed because it only reads existing snapshots.
      RAISE NOTICE 'billing snapshot skipped for order_item %, reason=%', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS billing_snapshot_order_item_after_insert ON public.order_items;
CREATE TRIGGER billing_snapshot_order_item_after_insert
  AFTER INSERT ON public.order_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_billing_snapshot_order_item();

-- ---------------------------------------------------------------------------
-- 3) Shared delivered-commission helper (snapshot only, idempotent ledger)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lp_billing_post_delivered_commission_unchecked(
  p_order_id uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_reason text DEFAULT 'order delivered'
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_snapshot record;
  v_inserted integer := 0;
  v_rows integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = p_order_id
      AND o.status = 'DELIVERED'::public.order_status
  ) THEN
    RAISE EXCEPTION 'ORDER_NOT_DELIVERED';
  END IF;

  FOR v_snapshot IN
    SELECT s.*
    FROM public.order_line_commercial_snapshots s
    JOIN public.order_items oi
      ON oi.id = s.order_line_id
     AND oi.order_id = s.order_id
    WHERE s.order_id = p_order_id
    ORDER BY s.order_line_id
  LOOP
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
      v_snapshot.provider_id,
      v_snapshot.organization_id,
      v_snapshot.order_id,
      v_snapshot.order_line_id,
      'ORDER_COMPLETED',
      v_snapshot.commission_rule_id,
      v_snapshot.commission_rate_bps,
      v_snapshot.market_id,
      v_snapshot.country_code,
      v_snapshot.tax_country_code,
      v_snapshot.currency,
      v_snapshot.line_subtotal_ex_tax_minor,
      (v_snapshot.line_subtotal_ex_tax_minor::numeric * v_snapshot.commission_rate_bps::numeric) / 10000,
      (
        SELECT to_char(v_snapshot.ordered_at AT TIME ZONE obp.billing_timezone, 'YYYY-MM')
        FROM public.organization_billing_profiles obp
        WHERE obp.organization_id = v_snapshot.provider_id
      ),
      concat('commission:ORDER_COMPLETED:', v_snapshot.order_id, ':', v_snapshot.order_line_id),
      p_reason,
      p_actor_user_id
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END LOOP;

  RETURN v_inserted;
END;
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_post_delivered_commission(p_order_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
BEGIN
  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'COMMISSION_POST_FORBIDDEN';
  END IF;

  RETURN private.lp_billing_post_delivered_commission_unchecked(
    p_order_id,
    auth.uid(),
    'manual delivered commission post'
  );
END;
$$;

-- Preserve the foundation RPC contract, but make it ledger-from-snapshot only.
CREATE OR REPLACE FUNCTION public.lp_billing_post_commission_for_order(
  p_order_id uuid,
  p_event_type text DEFAULT 'ORDER_COMPLETED',
  p_reason text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
BEGIN
  IF p_event_type <> 'ORDER_COMPLETED' THEN
    RAISE EXCEPTION 'COMMISSION_EVENT_NOT_IMPLEMENTED_IN_THIS_PHASE';
  END IF;

  IF NOT public.is_platform_admin() AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'COMMISSION_POST_FORBIDDEN';
  END IF;

  RETURN private.lp_billing_post_delivered_commission_unchecked(
    p_order_id,
    auth.uid(),
    coalesce(p_reason, 'manual delivered commission post')
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Provider status RPC path -> shared delivered commission helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_order_advance_status(
  p_order_id uuid,
  p_target_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_provider_id uuid;
  v_old_status text;
  v_target text;
  v_commission_inserted integer := 0;
BEGIN
  v_target := upper(trim(coalesce(p_target_status, '')));
  IF v_target NOT IN ('PREPARED', 'DISPATCHED', 'DELIVERED') THEN
    RAISE EXCEPTION 'INVALID_TARGET_STATUS' USING errcode = '22023';
  END IF;

  SELECT o.provider_id, upper(o.status::text)
  INTO v_provider_id, v_old_status
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING errcode = '02000';
  END IF;

  PERFORM private.lp_assert_provider_kitchen_access(v_provider_id);

  IF v_old_status IN ('CANCELLED', 'PAUSED') THEN
    RAISE EXCEPTION 'ORDER_NOT_ADVANCEABLE' USING errcode = '22023';
  END IF;

  IF v_old_status = v_target THEN
    RETURN jsonb_build_object('ok', true, 'already_at_status', true, 'from_status', v_old_status, 'to_status', v_target);
  END IF;

  IF v_old_status = 'DELIVERED' AND v_target = 'DISPATCHED' THEN
    IF NOT public.is_platform_admin()
      AND NOT EXISTS (
        SELECT 1
        FROM public.provider_memberships pm
        WHERE pm.user_id = auth.uid()
          AND pm.provider_id = v_provider_id
          AND pm.role = 'provider_admin'::public.provider_role
      ) THEN
      RAISE EXCEPTION 'PERMISSION_DENIED' USING errcode = '42501';
    END IF;
  ELSIF v_target = 'PREPARED' AND v_old_status IN ('ACTIVE', 'LOCKED') THEN
    NULL;
  ELSIF v_target = 'DISPATCHED' AND v_old_status = 'PREPARED' THEN
    NULL;
  ELSIF v_target = 'DELIVERED' AND v_old_status = 'DISPATCHED' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION' USING errcode = '22023';
  END IF;

  PERFORM set_config('app.batch_derived_advance', '1', true);
  PERFORM set_config('app.batch_derived_actor', auth.uid()::text, true);
  IF nullif(trim(p_note), '') IS NOT NULL THEN
    PERFORM set_config('app.batch_derived_note', trim(p_note), true);
  END IF;

  UPDATE public.orders
  SET status = v_target::public.order_status,
      updated_at = now()
  WHERE id = p_order_id;

  IF v_target = 'DELIVERED' THEN
    v_commission_inserted := private.lp_billing_post_delivered_commission_unchecked(
      p_order_id,
      auth.uid(),
      'order delivered via provider status'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'from_status', v_old_status,
    'to_status', v_target,
    'provider_id', v_provider_id,
    'commission_ledger_inserted', v_commission_inserted
  );
END;
$$;

COMMENT ON FUNCTION public.lp_order_advance_status(uuid, text, text) IS
  'Provider kitchen flow: ACTIVE/LOCKED→PREPARED→DISPATCHED→DELIVERED. DELIVERED posts idempotent commission ledger from immutable order-line commercial snapshots.';

-- ---------------------------------------------------------------------------
-- 5) Batch-derived status path -> same delivered commission helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lp_order_advance_one_step_for_batch(
  p_order_id uuid,
  p_target text,
  p_actor uuid,
  p_note text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_old text;
  v_target text;
  v_commission_inserted integer := 0;
BEGIN
  IF coalesce(current_setting('app.batch_derived_advance', true), '') <> '1' THEN
    RAISE EXCEPTION 'BATCH_DERIVED_FLAG_REQUIRED' USING errcode = '42501';
  END IF;

  v_target := upper(btrim(coalesce(p_target, '')));
  IF v_target NOT IN ('PREPARED', 'DISPATCHED', 'DELIVERED') THEN
    RAISE EXCEPTION 'INVALID_TARGET_STATUS' USING errcode = '22023';
  END IF;

  SELECT upper(o.status::text)
  INTO v_old
  FROM public.orders o
  WHERE o.id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND' USING errcode = '02000';
  END IF;

  IF v_old IN ('CANCELLED', 'PAUSED') THEN
    RETURN jsonb_build_object('ok', false, 'skipped', true, 'reason', 'not_advanceable', 'status', v_old);
  END IF;

  IF v_old = v_target THEN
    RETURN jsonb_build_object('ok', true, 'already_at_status', true, 'from_status', v_old, 'to_status', v_target);
  END IF;

  IF v_target = 'PREPARED' AND v_old IN ('ACTIVE', 'LOCKED') THEN
    NULL;
  ELSIF v_target = 'DISPATCHED' AND v_old = 'PREPARED' THEN
    NULL;
  ELSIF v_target = 'DELIVERED' AND v_old = 'DISPATCHED' THEN
    NULL;
  ELSE
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION' USING errcode = '22023';
  END IF;

  PERFORM set_config('app.batch_derived_actor', p_actor::text, true);
  PERFORM set_config('app.batch_derived_note', coalesce(nullif(btrim(p_note), ''), ''), true);

  UPDATE public.orders
  SET status = v_target::public.order_status,
      updated_at = now()
  WHERE id = p_order_id;

  IF v_target = 'DELIVERED' THEN
    v_commission_inserted := private.lp_billing_post_delivered_commission_unchecked(
      p_order_id,
      p_actor,
      coalesce(nullif(btrim(p_note), ''), 'order delivered via batch status')
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'from_status', v_old,
    'to_status', v_target,
    'commission_ledger_inserted', v_commission_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION private.lp_billing_create_order_line_snapshot_unchecked(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lp_billing_snapshot_order_unchecked(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lp_billing_post_delivered_commission_unchecked(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.lp_billing_post_delivered_commission(uuid) TO service_role;

COMMIT;
