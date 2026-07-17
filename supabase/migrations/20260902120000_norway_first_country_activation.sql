-- Phase 16NO — Norway-first country activation controls (fail-closed).
-- Does NOT enable Norway by default. Does NOT enable any other country.
-- Global 21-country cutover kill switch remains false.
-- Review-operations migration 20260901120000 is intentionally NOT included in this release.

BEGIN;

CREATE TABLE IF NOT EXISTS public.country_production_activation (
  country_code text PRIMARY KEY CHECK (char_length(country_code) = 2),
  production_enabled boolean NOT NULL DEFAULT false,
  registration_enabled boolean NOT NULL DEFAULT false,
  ordering_enabled boolean NOT NULL DEFAULT false,
  invoice_only_enabled boolean NOT NULL DEFAULT false,
  platform_commission_enabled boolean NOT NULL DEFAULT false,
  accountant_tax_confirmation text NOT NULL DEFAULT 'REQUIRED'
    CHECK (accountant_tax_confirmation IN ('REQUIRED', 'CONFIRMED', 'UNKNOWN')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text NULL,
  reason text NULL
);

COMMENT ON TABLE public.country_production_activation IS
  'Phase 16NO server-enforced country gates. Only NO may become enabled after accountant confirmation + operator flip.';

INSERT INTO public.country_production_activation (country_code)
SELECT unnest(ARRAY[
  'NO','SE','DK','FI','GB','DE','FR','ES','IT','NL','BE','CH','AT','IE','PL','RO','CZ','PT','GR','US','CA'
])
ON CONFLICT (country_code) DO NOTHING;

-- Hard lock: non-NO rows may never be enabled via this trigger.
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
     AND (NEW.ordering_enabled OR NEW.platform_commission_enabled OR NEW.invoice_only_enabled)
     AND NEW.accountant_tax_confirmation <> 'CONFIRMED' THEN
    RAISE EXCEPTION 'NORWAY_FISCAL_REQUIRES_ACCOUNTANT_CONFIRMATION';
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

-- Keep global kill switch off (21-country simultaneous cutover remains blocked).
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
  IF v_row.accountant_tax_confirmation <> 'CONFIRMED' THEN
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
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.lp_country_production_allowed(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.lp_country_production_allowed(text, text) TO authenticated, service_role;

-- Tighten commercial invoice gate: market_approvals ACTIVE is insufficient without Norway-first flags.
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

COMMIT;
