-- Global Billing Engine phase: billing-profile readiness + fail-closed observability.
--
-- Scope:
-- - Readiness RPC for provider billing/snapshot/ledger/invoice prerequisites.
-- - Idempotent diagnostic event table for fail-closed snapshot skips.
-- - No payment provider, card charge, invoice sending, UI, correction/refund engine,
--   order pricing change, or live apply.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Diagnostic events: fail-closed observability without order-path blocking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.billing_readiness_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  order_id uuid NULL REFERENCES public.orders (id) ON DELETE SET NULL,
  order_line_id uuid NULL REFERENCES public.order_items (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  missing_requirements text[] NOT NULL DEFAULT '{}'::text[],
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT billing_readiness_events_event_type_chk CHECK (
    event_type IN (
      'SNAPSHOT_SKIPPED',
      'LEDGER_SKIPPED',
      'READINESS_CHECK'
    )
  ),
  CONSTRAINT billing_readiness_events_detail_obj_chk CHECK (jsonb_typeof(detail) = 'object'),
  CONSTRAINT billing_readiness_events_idempotency_key_uniq UNIQUE (idempotency_key)
);

COMMENT ON TABLE public.billing_readiness_events IS
  'Idempotent diagnostics for Global Billing Engine readiness gaps. No payment secrets or raw card data.';

CREATE INDEX IF NOT EXISTS billing_readiness_events_provider_created_idx
  ON public.billing_readiness_events (provider_id, created_at DESC)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS billing_readiness_events_order_line_idx
  ON public.billing_readiness_events (order_id, order_line_id)
  WHERE order_id IS NOT NULL;

ALTER TABLE public.billing_readiness_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS billing_readiness_events_provider_select ON public.billing_readiness_events;
CREATE POLICY billing_readiness_events_provider_select
  ON public.billing_readiness_events
  FOR SELECT
  TO authenticated
  USING (
    provider_id IS NOT NULL
    AND public.lp_billing_can_access_provider(provider_id)
  );

DROP POLICY IF EXISTS billing_readiness_events_platform_admin_all ON public.billing_readiness_events;
CREATE POLICY billing_readiness_events_platform_admin_all
  ON public.billing_readiness_events
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS billing_readiness_events_service_role_all ON public.billing_readiness_events;
CREATE POLICY billing_readiness_events_service_role_all
  ON public.billing_readiness_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.billing_readiness_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.billing_readiness_events TO authenticated;
GRANT ALL ON TABLE public.billing_readiness_events TO service_role;

-- ---------------------------------------------------------------------------
-- 2) Shared readiness computation
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lp_billing_provider_missing_requirements(
  p_provider_id uuid
)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, private
AS $$
  WITH base AS (
    SELECT
      p.id AS provider_id,
      o.id AS organization_id,
      obp.organization_id AS billing_profile_id,
      m.id AS market_id,
      nullif(trim(coalesce(obp.billing_currency, '')), '') AS billing_currency,
      nullif(trim(coalesce(obp.billing_timezone, '')), '') AS billing_timezone,
      nullif(trim(coalesce(obp.legal_country_code, '')), '') AS legal_country_code,
      nullif(trim(coalesce(obp.tax_country_code, '')), '') AS tax_country_code,
      EXISTS (
        SELECT 1
        FROM public.commission_rules cr
        WHERE cr.code = 'LP_GLOBAL_5P'
          AND cr.version = 1
          AND cr.rate_bps = 500
          AND cr.basis = 'NET_LUNCH_MENU_SALES_EX_TAX'
          AND cr.applies_to = 'COMPLETED_LUNCH_ORDERS'
          AND cr.active_to IS NULL
      ) AS has_active_commission_rule,
      nullif(trim(coalesce(obp.billing_email_current, '')), '') IS NOT NULL AS has_billing_email,
      EXISTS (
        SELECT 1
        FROM public.provider_memberships pm
        JOIN auth.users u ON u.id = pm.user_id
        WHERE pm.provider_id = p.id
          AND pm.role = 'provider_admin'::public.provider_role
          AND u.email IS NOT NULL
          AND u.email_confirmed_at IS NOT NULL
      ) AS has_verified_admin_email,
      nullif(trim(coalesce(obp.payment_provider_customer_id, '')), '') IS NOT NULL AS has_payment_customer,
      obp.default_payment_method_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.payment_methods pm
          WHERE pm.id = obp.default_payment_method_id
            AND pm.organization_id = obp.organization_id
            AND pm.status = 'active'
        ) AS has_active_payment_method
    FROM public.providers p
    LEFT JOIN public.organizations o
      ON o.id = p.id
     AND o.type = 'provider'::public.org_type
    LEFT JOIN public.organization_billing_profiles obp
      ON obp.organization_id = p.id
    LEFT JOIN public.markets m
      ON m.id = obp.market_id
    WHERE p.id = p_provider_id
  ),
  missing AS (
    SELECT 'provider_missing' AS requirement FROM base WHERE provider_id IS NULL
    UNION ALL SELECT 'organization_missing' FROM base WHERE organization_id IS NULL
    UNION ALL SELECT 'billing_profile_missing' FROM base WHERE billing_profile_id IS NULL
    UNION ALL SELECT 'market_missing' FROM base WHERE market_id IS NULL
    UNION ALL SELECT 'billing_currency_missing' FROM base WHERE billing_currency IS NULL
    UNION ALL SELECT 'billing_timezone_missing' FROM base WHERE billing_timezone IS NULL
    UNION ALL SELECT 'legal_country_code_missing' FROM base WHERE legal_country_code IS NULL
    UNION ALL SELECT 'tax_country_code_missing' FROM base WHERE tax_country_code IS NULL
    UNION ALL SELECT 'active_commission_rule_missing' FROM base WHERE NOT coalesce(has_active_commission_rule, false)
    UNION ALL SELECT 'invoice_recipient_missing' FROM base WHERE NOT (coalesce(has_billing_email, false) OR coalesce(has_verified_admin_email, false))
    UNION ALL SELECT 'payment_customer_missing' FROM base WHERE NOT coalesce(has_payment_customer, false)
    UNION ALL SELECT 'payment_method_missing' FROM base WHERE NOT coalesce(has_active_payment_method, false)
  )
  SELECT coalesce(array_agg(requirement ORDER BY requirement), '{}'::text[])
  FROM missing;
$$;

CREATE OR REPLACE FUNCTION public.lp_billing_provider_readiness(p_provider_id uuid DEFAULT NULL)
RETURNS TABLE (
  provider_id uuid,
  provider_name text,
  organization_id uuid,
  market_id uuid,
  market_slug text,
  locale text,
  country_code text,
  tax_country_code text,
  billing_currency text,
  billing_timezone text,
  has_billing_profile boolean,
  has_market boolean,
  has_active_commission_rule boolean,
  has_billing_email boolean,
  has_verified_admin_email boolean,
  snapshot_ready boolean,
  ledger_ready boolean,
  invoice_ready boolean,
  missing_requirements text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public, private
AS $$
  WITH active_rule AS (
    SELECT EXISTS (
      SELECT 1
      FROM public.commission_rules cr
      WHERE cr.code = 'LP_GLOBAL_5P'
        AND cr.version = 1
        AND cr.rate_bps = 500
        AND cr.basis = 'NET_LUNCH_MENU_SALES_EX_TAX'
        AND cr.applies_to = 'COMPLETED_LUNCH_ORDERS'
        AND cr.active_to IS NULL
    ) AS ok
  ),
  rows AS (
    SELECT
      p.id AS provider_id,
      p.name AS provider_name,
      o.id AS organization_id,
      m.id AS market_id,
      m.slug AS market_slug,
      m.locale AS locale,
      m.country_code AS country_code,
      m.tax_country_code AS tax_country_code,
      obp.billing_currency AS billing_currency,
      obp.billing_timezone AS billing_timezone,
      obp.organization_id IS NOT NULL AS has_billing_profile,
      m.id IS NOT NULL AS has_market,
      ar.ok AS has_active_commission_rule,
      nullif(trim(coalesce(obp.billing_email_current, '')), '') IS NOT NULL AS has_billing_email,
      EXISTS (
        SELECT 1
        FROM public.provider_memberships pm
        JOIN auth.users u ON u.id = pm.user_id
        WHERE pm.provider_id = p.id
          AND pm.role = 'provider_admin'::public.provider_role
          AND u.email IS NOT NULL
          AND u.email_confirmed_at IS NOT NULL
      ) AS has_verified_admin_email,
      nullif(trim(coalesce(obp.payment_provider_customer_id, '')), '') IS NOT NULL AS has_payment_customer,
      obp.default_payment_method_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.payment_methods pm
          WHERE pm.id = obp.default_payment_method_id
            AND pm.organization_id = obp.organization_id
            AND pm.status = 'active'
        ) AS has_active_payment_method,
      private.lp_billing_provider_missing_requirements(p.id) AS missing_requirements
    FROM public.providers p
    CROSS JOIN active_rule ar
    LEFT JOIN public.organizations o
      ON o.id = p.id
     AND o.type = 'provider'::public.org_type
    LEFT JOIN public.organization_billing_profiles obp
      ON obp.organization_id = p.id
    LEFT JOIN public.markets m
      ON m.id = obp.market_id
    WHERE p.deleted_at IS NULL
      AND (p_provider_id IS NULL OR p.id = p_provider_id)
      AND (
        auth.role() = 'service_role'
        OR public.is_platform_admin()
        OR public.can_access_provider(p.id)
      )
  )
  SELECT
    provider_id,
    provider_name,
    organization_id,
    market_id,
    market_slug,
    locale,
    country_code,
    tax_country_code,
    billing_currency,
    billing_timezone,
    has_billing_profile,
    has_market,
    has_active_commission_rule,
    has_billing_email,
    has_verified_admin_email,
    (
      organization_id IS NOT NULL
      AND has_billing_profile
      AND has_market
      AND billing_currency IS NOT NULL
      AND nullif(trim(billing_currency), '') IS NOT NULL
      AND billing_timezone IS NOT NULL
      AND nullif(trim(billing_timezone), '') IS NOT NULL
      AND country_code IS NOT NULL
      AND tax_country_code IS NOT NULL
      AND has_active_commission_rule
    ) AS snapshot_ready,
    (
      organization_id IS NOT NULL
      AND has_billing_profile
      AND has_market
      AND billing_currency IS NOT NULL
      AND nullif(trim(billing_currency), '') IS NOT NULL
      AND billing_timezone IS NOT NULL
      AND nullif(trim(billing_timezone), '') IS NOT NULL
      AND country_code IS NOT NULL
      AND tax_country_code IS NOT NULL
      AND has_active_commission_rule
    ) AS ledger_ready,
    (
      organization_id IS NOT NULL
      AND has_billing_profile
      AND has_market
      AND billing_currency IS NOT NULL
      AND nullif(trim(billing_currency), '') IS NOT NULL
      AND billing_timezone IS NOT NULL
      AND nullif(trim(billing_timezone), '') IS NOT NULL
      AND country_code IS NOT NULL
      AND tax_country_code IS NOT NULL
      AND has_active_commission_rule
      AND (has_billing_email OR has_verified_admin_email)
      AND has_payment_customer
      AND has_active_payment_method
    ) AS invoice_ready,
    missing_requirements
  FROM rows
  ORDER BY provider_name, provider_id;
$$;

COMMENT ON FUNCTION public.lp_billing_provider_readiness(uuid) IS
  'Read-only Global Billing Engine readiness. No payment secrets or raw card data. Provider sees own provider only; platform/service sees all.';

GRANT EXECUTE ON FUNCTION public.lp_billing_provider_readiness(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Idempotent diagnostic logging for fail-closed snapshot skips
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.lp_billing_record_readiness_event_unchecked(
  p_order_line_id uuid,
  p_event_type text,
  p_error text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, private
AS $$
DECLARE
  v_provider_id uuid;
  v_order_id uuid;
  v_missing text[];
BEGIN
  SELECT o.provider_id, o.id
  INTO v_provider_id, v_order_id
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.id = p_order_line_id;

  IF v_order_id IS NULL THEN
    RETURN;
  END IF;

  IF v_provider_id IS NOT NULL THEN
    v_missing := private.lp_billing_provider_missing_requirements(v_provider_id);
  ELSE
    v_missing := ARRAY['provider_missing']::text[];
  END IF;

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
    v_provider_id,
    v_order_id,
    p_order_line_id,
    p_event_type,
    coalesce(v_missing, '{}'::text[]),
    jsonb_build_object('error', left(coalesce(p_error, ''), 500)),
    concat('billing-readiness:', p_event_type, ':', v_order_id, ':', p_order_line_id)
  )
  ON CONFLICT (idempotency_key) DO NOTHING;
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
      BEGIN
        PERFORM private.lp_billing_record_readiness_event_unchecked(
          NEW.id,
          'SNAPSHOT_SKIPPED',
          SQLERRM
        );
      EXCEPTION
        WHEN OTHERS THEN
          NULL;
      END;

      -- Do not break the protected order path for providers not yet billing-ready.
      -- Ledger posting remains fail-closed because it only reads existing snapshots.
      RAISE NOTICE 'billing snapshot skipped for order_item %, reason=%', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.lp_billing_provider_missing_requirements(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.lp_billing_record_readiness_event_unchecked(uuid, text, text) FROM PUBLIC, anon, authenticated;

COMMIT;
