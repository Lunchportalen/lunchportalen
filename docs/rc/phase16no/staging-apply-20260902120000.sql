-- Phase 16NO - Norway-first country activation controls (fail-closed).
-- Does NOT enable Norway by default. Does NOT enable any other country.
-- Global 21-country cutover kill switch remains false.
-- Owner waived accountant confirmation for cutover.
-- Real platform MVA invoices require mva_registered = true.
-- Review-operations migration 20260901120000 is intentionally NOT included in this release.CREATE TABLE IF NOT EXISTS public.country_production_activation (
  country_code text PRIMARY KEY CHECK (char_length(country_code) = 2),
  production_enabled boolean NOT NULL DEFAULT false,
  registration_enabled boolean NOT NULL DEFAULT false,
  ordering_enabled boolean NOT NULL DEFAULT false,
  invoice_only_enabled boolean NOT NULL DEFAULT false,
  platform_commission_enabled boolean NOT NULL DEFAULT false,
  -- Legacy/audit column. Cutover no longer requires CONFIRMED when owner waiver is set.
  accountant_tax_confirmation text NOT NULL DEFAULT 'NOT_REQUIRED_FOR_CUTOVER'
    CHECK (accountant_tax_confirmation IN ('REQUIRED', 'CONFIRMED', 'UNKNOWN', 'NOT_REQUIRED_FOR_CUTOVER')),
  owner_tax_model_confirmation text NOT NULL DEFAULT 'REQUIRED'
    CHECK (owner_tax_model_confirmation IN ('REQUIRED', 'CONFIRMED', 'UNKNOWN')),
  owner_accepts_tax_classification_responsibility boolean NOT NULL DEFAULT false,
  accountant_confirmation_waived_by_owner boolean NOT NULL DEFAULT false,
  mva_registered boolean NOT NULL DEFAULT false,
  platform_invoice_vat_25_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  reason text NULL
);

COMMENT ON TABLE public.country_production_activation IS
  'Phase 16NO server-enforced country gates. Only NO may become enabled after owner tax approval (+ optional MVA for real VAT invoices).';

-- Upgrade path if an earlier rehearsal created a narrower table.
ALTER TABLE public.country_production_activation
  ADD COLUMN IF NOT EXISTS owner_tax_model_confirmation text NOT NULL DEFAULT 'REQUIRED';
ALTER TABLE public.country_production_activation
  ADD COLUMN IF NOT EXISTS owner_accepts_tax_classification_responsibility boolean NOT NULL DEFAULT false;
ALTER TABLE public.country_production_activation
  ADD COLUMN IF NOT EXISTS accountant_confirmation_waived_by_owner boolean NOT NULL DEFAULT false;
ALTER TABLE public.country_production_activation
  ADD COLUMN IF NOT EXISTS mva_registered boolean NOT NULL DEFAULT false;
ALTER TABLE public.country_production_activation
  ADD COLUMN IF NOT EXISTS platform_invoice_vat_25_enabled boolean NOT NULL DEFAULT false;

-- Widen accountant confirmation check for owner waiver (idempotent).
DO $$
DECLARE
  cname text;
BEGIN
  SELECT con.conname INTO cname
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
  WHERE nsp.nspname = 'public'
    AND rel.relname = 'country_production_activation'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%accountant_tax_confirmation%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.country_production_activation DROP CONSTRAINT %I', cname);
  END IF;
  ALTER TABLE public.country_production_activation
    ADD CONSTRAINT country_production_activation_accountant_tax_chk
    CHECK (accountant_tax_confirmation IN ('REQUIRED', 'CONFIRMED', 'UNKNOWN', 'NOT_REQUIRED_FOR_CUTOVER'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.country_production_activation (country_code)
SELECT unnest(ARRAY[
  'NO','SE','DK','FI','GB','DE','FR','ES','IT','NL','BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA'
])
ON CONFLICT (country_code) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trg_country_production_activation_guard()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.country_code <> 'NO' THEN
    IF NEW.production_enabled OR NEW.registration_enabled OR NEW.ordering_enabled
       OR NEW.invoice_only_enabled OR NEW.platform_commission_enabled THEN
      RAISE EXCEPTION 'NON_NO_COUNTRY_ACTIVATION_FORBIDDEN:%', NEW.country_code;
    END IF;
  END IF;

  IF NEW.country_code = 'NO'
     AND (NEW.ordering_enabled OR NEW.platform_commission_enabled OR NEW.invoice_only_enabled OR NEW.production_enabled)
  THEN
    IF NEW.owner_tax_model_confirmation <> 'CONFIRMED' THEN
      RAISE EXCEPTION 'NORWAY_REQUIRES_OWNER_TAX_MODEL_CONFIRMATION';
    END IF;
    IF NOT NEW.owner_accepts_tax_classification_responsibility THEN
      RAISE EXCEPTION 'NORWAY_REQUIRES_OWNER_TAX_RESPONSIBILITY_ACCEPTANCE';
    END IF;
    IF NOT NEW.accountant_confirmation_waived_by_owner
       AND NEW.accountant_tax_confirmation NOT IN ('CONFIRMED', 'NOT_REQUIRED_FOR_CUTOVER') THEN
      RAISE EXCEPTION 'NORWAY_REQUIRES_OWNER_WAIVER_OR_ACCOUNTANT_CONFIRMATION';
    END IF;
  END IF;

  -- Real MVA on platform invoices: only when verified Merverdiavgiftsregisteret registration.
  IF NEW.country_code = 'NO' AND NEW.platform_invoice_vat_25_enabled AND NOT NEW.mva_registered THEN
    RAISE EXCEPTION 'PLATFORM_VAT_25_REQUIRES_MVA_REGISTRATION';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS country_production_activation_guard ON public.country_production_activation;
CREATE TRIGGER country_production_activation_guard
  BEFORE INSERT OR UPDATE ON public.country_production_activation
  FOR EACH ROW EXECUTE FUNCTION public.trg_country_production_activation_guard();

ALTER TABLE public.country_production_activation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.country_production_activation FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.country_production_activation TO authenticated, service_role;
GRANT ALL ON TABLE public.country_production_activation TO service_role;

DROP POLICY IF EXISTS country_production_activation_read ON public.country_production_activation;
CREATE POLICY country_production_activation_read ON public.country_production_activation
  FOR SELECT TO authenticated
  USING (true);

UPDATE public.global_activation_kill_switch
SET global_cutover_allowed = false,
    reason = 'Phase 16NO: Norway-first path only; GLOBAL_21 cutover remains blocked',
    updated_at = now()
WHERE id = 1;

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
    -- Invoice-only payment mode (Stripe off). Does NOT imply MVA may be charged.
    RETURN v_row.invoice_only_enabled;
  ELSIF v_action = 'commission' THEN
    RETURN v_row.platform_commission_enabled;
  ELSIF v_action = 'platform_mva_invoice' THEN
    RETURN v_row.platform_commission_enabled
      AND v_row.mva_registered
      AND v_row.platform_invoice_vat_25_enabled;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.lp_country_production_allowed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lp_country_production_allowed(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.lp_market_commercially_active(p_country_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.market_approvals ma
    WHERE ma.country_code = upper(trim(coalesce(p_country_code, '')))
      AND ma.status = 'ACTIVE'
  )
  AND public.lp_country_production_allowed(p_country_code, 'invoice');
$$;

GRANT EXECUTE ON FUNCTION public.lp_market_commercially_active(text) TO authenticated, service_role;