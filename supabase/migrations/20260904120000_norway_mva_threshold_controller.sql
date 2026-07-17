-- Phase 16NO.4 — Automatic Norway MVA threshold controller (additive).
-- Does NOT enable platform_invoice_vat_25_enabled.
-- Does NOT mutate existing financial rows.
-- Threshold comparison: strictly greater than NOK 50_000 (5_000_000 minor).

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Taxable turnover event mirror (immutable audit of recognition)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.norway_mva_taxable_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_event_id uuid NOT NULL UNIQUE REFERENCES public.commission_ledger (id) ON DELETE RESTRICT,
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE RESTRICT,
  order_id uuid NULL REFERENCES public.orders (id) ON DELETE RESTRICT,
  country_code text NOT NULL DEFAULT 'NO' CHECK (country_code = 'NO'),
  recognition_at timestamptz NOT NULL,
  order_net_ex_customer_tax_minor bigint NOT NULL,
  commission_rate_bps integer NOT NULL DEFAULT 500 CHECK (commission_rate_bps = 500),
  commission_net_minor bigint NOT NULL,
  invoice_assignment text NULL,
  threshold_before_minor bigint NOT NULL,
  threshold_after_minor bigint NOT NULL,
  is_crossing_event boolean NOT NULL DEFAULT false,
  classification text NOT NULL DEFAULT 'PLATFORM_COMMISSION'
    CHECK (classification IN (
      'PLATFORM_COMMISSION',
      'OTHER_TAXABLE_SERVICE',
      'EXCLUDED',
      'REVERSAL'
    )),
  exclude_reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by text NOT NULL DEFAULT 'system'
);

COMMENT ON TABLE public.norway_mva_taxable_events IS
  'Phase 16NO.4 immutable taxable supply records for Lunchportalen AS Norway MVA threshold.';

CREATE INDEX IF NOT EXISTS norway_mva_taxable_events_recognition_idx
  ON public.norway_mva_taxable_events (recognition_at);
CREATE INDEX IF NOT EXISTS norway_mva_taxable_events_crossing_idx
  ON public.norway_mva_taxable_events (is_crossing_event) WHERE is_crossing_event;

CREATE OR REPLACE FUNCTION public.lp_norway_mva_taxable_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  RAISE EXCEPTION 'norway_mva_taxable_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS norway_mva_taxable_events_no_update ON public.norway_mva_taxable_events;
CREATE TRIGGER norway_mva_taxable_events_no_update
  BEFORE UPDATE ON public.norway_mva_taxable_events
  FOR EACH ROW EXECUTE FUNCTION public.lp_norway_mva_taxable_events_immutable();

DROP TRIGGER IF EXISTS norway_mva_taxable_events_no_delete ON public.norway_mva_taxable_events;
CREATE TRIGGER norway_mva_taxable_events_no_delete
  BEFORE DELETE ON public.norway_mva_taxable_events
  FOR EACH ROW EXECUTE FUNCTION public.lp_norway_mva_taxable_events_immutable();

-- ---------------------------------------------------------------------------
-- 2) Threshold calculation snapshots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.norway_mva_threshold_calculations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity text NOT NULL DEFAULT 'Lunchportalen AS',
  calculated_at timestamptz NOT NULL DEFAULT now(),
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  recognized_minor bigint NOT NULL,
  invoiced_minor bigint NOT NULL,
  remaining_minor bigint NOT NULL,
  percent_bps integer NOT NULL,
  status text NOT NULL,
  crossing_event_id uuid NULL,
  included_event_ids uuid[] NOT NULL DEFAULT '{}',
  excluded_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  calculation_checksum text NOT NULL,
  release_sha text NULL,
  UNIQUE (legal_entity, calculated_at, calculation_checksum)
);

CREATE INDEX IF NOT EXISTS norway_mva_threshold_calculations_calc_idx
  ON public.norway_mva_threshold_calculations (calculated_at DESC);

-- ---------------------------------------------------------------------------
-- 3) Invoice holds (crossing + later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.norway_mva_invoice_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ledger_event_id uuid NOT NULL UNIQUE REFERENCES public.commission_ledger (id) ON DELETE RESTRICT,
  legal_entity text NOT NULL DEFAULT 'Lunchportalen AS',
  country_code text NOT NULL DEFAULT 'NO' CHECK (country_code = 'NO'),
  status text NOT NULL DEFAULT 'HELD'
    CHECK (status IN ('HELD', 'RELEASED_WITH_VAT', 'RELEASED_WITHOUT_VAT', 'CANCELLED')),
  is_crossing_event boolean NOT NULL DEFAULT false,
  threshold_before_minor bigint NOT NULL DEFAULT 0,
  threshold_after_minor bigint NOT NULL DEFAULT 0,
  commission_net_minor bigint NOT NULL DEFAULT 0,
  policy text NOT NULL DEFAULT 'HOLD_UNTIL_REGISTERED'
    CHECK (policy IN ('HOLD_UNTIL_REGISTERED', 'INVOICE_WITH_MVA_RESERVATION_AND_REISSUE')),
  reason text NOT NULL,
  held_by text NOT NULL,
  held_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz NULL,
  released_by text NULL,
  release_invoice_id uuid NULL REFERENCES public.provider_commission_invoices (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS norway_mva_invoice_holds_status_idx
  ON public.norway_mva_invoice_holds (status);

-- ---------------------------------------------------------------------------
-- 4) Official registration checks (Brønnøysund)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.norway_mva_registration_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orgnr text NOT NULL,
  legal_name text NULL,
  registered_in_mva boolean NULL,
  official_source text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  evidence_reference text NULL,
  checksum text NULL,
  ok boolean NOT NULL DEFAULT false,
  error_code text NULL,
  http_status integer NULL,
  actor text NOT NULL DEFAULT 'system'
);

CREATE INDEX IF NOT EXISTS norway_mva_registration_checks_checked_idx
  ON public.norway_mva_registration_checks (checked_at DESC);

-- ---------------------------------------------------------------------------
-- 5) Durable warnings (deduped)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.norway_mva_threshold_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_entity text NOT NULL DEFAULT 'Lunchportalen AS',
  threshold_band text NOT NULL,
  status text NOT NULL,
  recognized_minor bigint NOT NULL,
  invoiced_minor bigint NOT NULL,
  remaining_minor bigint NOT NULL,
  percent_bps integer NOT NULL,
  crossing_event_id uuid NULL,
  invoice_transmission text NOT NULL,
  dedupe_key text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor text NOT NULL DEFAULT 'system',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS norway_mva_threshold_warnings_created_idx
  ON public.norway_mva_threshold_warnings (created_at DESC);

-- ---------------------------------------------------------------------------
-- 6) Immutable audit trail for state transitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.norway_mva_threshold_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL,
  legal_entity text NOT NULL DEFAULT 'Lunchportalen AS',
  actor text NOT NULL,
  event_at timestamptz NOT NULL DEFAULT now(),
  previous_state text NULL,
  new_state text NOT NULL,
  reason text NOT NULL,
  source_records jsonb NOT NULL DEFAULT '{}'::jsonb,
  calculation_checksum text NULL,
  release_sha text NULL
);

CREATE OR REPLACE FUNCTION public.lp_norway_mva_threshold_audit_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  RAISE EXCEPTION 'norway_mva_threshold_audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS norway_mva_threshold_audit_no_update ON public.norway_mva_threshold_audit;
CREATE TRIGGER norway_mva_threshold_audit_no_update
  BEFORE UPDATE ON public.norway_mva_threshold_audit
  FOR EACH ROW EXECUTE FUNCTION public.lp_norway_mva_threshold_audit_immutable();

DROP TRIGGER IF EXISTS norway_mva_threshold_audit_no_delete ON public.norway_mva_threshold_audit;
CREATE TRIGGER norway_mva_threshold_audit_no_delete
  BEFORE DELETE ON public.norway_mva_threshold_audit
  FOR EACH ROW EXECUTE FUNCTION public.lp_norway_mva_threshold_audit_immutable();

-- ---------------------------------------------------------------------------
-- 7) Controller config (singleton)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.norway_mva_threshold_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  threshold_minor bigint NOT NULL DEFAULT 5000000 CHECK (threshold_minor = 5000000),
  currency text NOT NULL DEFAULT 'NOK' CHECK (currency = 'NOK'),
  comparison text NOT NULL DEFAULT 'STRICTLY_GREATER_THAN'
    CHECK (comparison = 'STRICTLY_GREATER_THAN'),
  period text NOT NULL DEFAULT 'ROLLING_12_MONTHS'
    CHECK (period = 'ROLLING_12_MONTHS'),
  crossing_invoice_policy text NOT NULL DEFAULT 'HOLD_UNTIL_REGISTERED'
    CHECK (crossing_invoice_policy IN ('HOLD_UNTIL_REGISTERED', 'INVOICE_WITH_MVA_RESERVATION_AND_REISSUE')),
  controller_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL
);

INSERT INTO public.norway_mva_threshold_config (id, controller_enabled)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.norway_mva_threshold_config IS
  'Phase 16NO.4 controller kill/activate. Dark-deploy starts with controller_enabled=false.';

-- ---------------------------------------------------------------------------
-- 8) Extend country gate: platform_invoice_without_mva (pre-registration)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lp_country_production_allowed(p_country_code text, p_action text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.country_production_activation%ROWTYPE;
  v_cc text := upper(trim(p_country_code));
  v_action text := lower(trim(p_action));
  v_owner_ok boolean;
  v_hold_count integer := 0;
BEGIN
  IF v_cc IS NULL OR v_cc = '' THEN
    RETURN false;
  END IF;
  SELECT * INTO v_row FROM public.country_production_activation WHERE country_code = v_cc;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  IF v_cc <> 'NO' THEN
    RETURN false;
  END IF;

  v_owner_ok :=
    v_row.owner_tax_model_confirmation = 'CONFIRMED'
    AND v_row.owner_accepts_tax_classification_responsibility
    AND (
      v_row.accountant_confirmation_waived_by_owner
      OR v_row.accountant_tax_confirmation IN ('CONFIRMED', 'NOT_REQUIRED_FOR_CUTOVER')
    );

  IF NOT v_owner_ok THEN
    RETURN false;
  END IF;
  IF NOT v_row.production_enabled THEN
    RETURN false;
  END IF;

  IF v_action = 'register' THEN
    RETURN v_row.registration_enabled;
  ELSIF v_action = 'order' THEN
    RETURN v_row.ordering_enabled;
  ELSIF v_action = 'invoice' THEN
    RETURN v_row.invoice_only_enabled;
  ELSIF v_action = 'commission' THEN
    RETURN v_row.platform_commission_enabled;
  ELSIF v_action = 'platform_mva_invoice' THEN
    RETURN v_row.platform_commission_enabled
      AND v_row.mva_registered
      AND v_row.platform_invoice_vat_25_enabled;
  ELSIF v_action = 'platform_invoice_without_mva' THEN
    IF NOT v_row.platform_commission_enabled OR NOT v_row.invoice_only_enabled THEN
      RETURN false;
    END IF;
    IF v_row.mva_registered AND v_row.platform_invoice_vat_25_enabled THEN
      -- Prefer MVA path once registered; without-MVA still structurally allowed for history.
      RETURN true;
    END IF;
    SELECT count(*)::integer INTO v_hold_count
    FROM public.norway_mva_invoice_holds
    WHERE status = 'HELD';
    IF v_hold_count > 0 THEN
      RETURN false;
    END IF;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.lp_country_production_allowed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lp_country_production_allowed(text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9) RLS — superadmin / service_role only for threshold tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.norway_mva_taxable_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.norway_mva_threshold_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.norway_mva_invoice_holds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.norway_mva_registration_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.norway_mva_threshold_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.norway_mva_threshold_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.norway_mva_threshold_config ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.norway_mva_taxable_events FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.norway_mva_threshold_calculations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.norway_mva_invoice_holds FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.norway_mva_registration_checks FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.norway_mva_threshold_warnings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.norway_mva_threshold_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.norway_mva_threshold_config FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.norway_mva_taxable_events TO service_role;
GRANT ALL ON TABLE public.norway_mva_threshold_calculations TO service_role;
GRANT ALL ON TABLE public.norway_mva_invoice_holds TO service_role;
GRANT ALL ON TABLE public.norway_mva_registration_checks TO service_role;
GRANT ALL ON TABLE public.norway_mva_threshold_warnings TO service_role;
GRANT ALL ON TABLE public.norway_mva_threshold_audit TO service_role;
GRANT ALL ON TABLE public.norway_mva_threshold_config TO service_role;

-- Authenticated superadmin read via profiles.role (fail-closed).
CREATE OR REPLACE FUNCTION public.lp_is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'superadmin'
  );
$$;

REVOKE ALL ON FUNCTION public.lp_is_superadmin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lp_is_superadmin() TO authenticated, service_role;

DROP POLICY IF EXISTS norway_mva_taxable_events_sa_read ON public.norway_mva_taxable_events;
CREATE POLICY norway_mva_taxable_events_sa_read ON public.norway_mva_taxable_events
  FOR SELECT TO authenticated USING (public.lp_is_superadmin());

DROP POLICY IF EXISTS norway_mva_threshold_calculations_sa_read ON public.norway_mva_threshold_calculations;
CREATE POLICY norway_mva_threshold_calculations_sa_read ON public.norway_mva_threshold_calculations
  FOR SELECT TO authenticated USING (public.lp_is_superadmin());

DROP POLICY IF EXISTS norway_mva_invoice_holds_sa_read ON public.norway_mva_invoice_holds;
CREATE POLICY norway_mva_invoice_holds_sa_read ON public.norway_mva_invoice_holds
  FOR SELECT TO authenticated USING (public.lp_is_superadmin());

DROP POLICY IF EXISTS norway_mva_registration_checks_sa_read ON public.norway_mva_registration_checks;
CREATE POLICY norway_mva_registration_checks_sa_read ON public.norway_mva_registration_checks
  FOR SELECT TO authenticated USING (public.lp_is_superadmin());

DROP POLICY IF EXISTS norway_mva_threshold_warnings_sa_read ON public.norway_mva_threshold_warnings;
CREATE POLICY norway_mva_threshold_warnings_sa_read ON public.norway_mva_threshold_warnings
  FOR SELECT TO authenticated USING (public.lp_is_superadmin());

DROP POLICY IF EXISTS norway_mva_threshold_audit_sa_read ON public.norway_mva_threshold_audit;
CREATE POLICY norway_mva_threshold_audit_sa_read ON public.norway_mva_threshold_audit
  FOR SELECT TO authenticated USING (public.lp_is_superadmin());

DROP POLICY IF EXISTS norway_mva_threshold_config_sa_read ON public.norway_mva_threshold_config;
CREATE POLICY norway_mva_threshold_config_sa_read ON public.norway_mva_threshold_config
  FOR SELECT TO authenticated USING (public.lp_is_superadmin());

GRANT SELECT ON TABLE public.norway_mva_taxable_events TO authenticated;
GRANT SELECT ON TABLE public.norway_mva_threshold_calculations TO authenticated;
GRANT SELECT ON TABLE public.norway_mva_invoice_holds TO authenticated;
GRANT SELECT ON TABLE public.norway_mva_registration_checks TO authenticated;
GRANT SELECT ON TABLE public.norway_mva_threshold_warnings TO authenticated;
GRANT SELECT ON TABLE public.norway_mva_threshold_audit TO authenticated;
GRANT SELECT ON TABLE public.norway_mva_threshold_config TO authenticated;

COMMIT;
