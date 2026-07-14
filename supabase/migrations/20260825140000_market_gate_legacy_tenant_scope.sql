-- PHASE 10 — presisering av fakturagatens omfang (regresjonssikring).
--
-- Root cause: markedsaktiverings-vokteren blokkerte også LEGACY-norske
-- fakturagenatorer (lp_provider_generate_agreement_invoice_for_period /
-- lp_run_daily_agreement_billing) for tenants som forhåndsdaterer den globale
-- billingmodellen og derfor ikke har organization_billing_profiles-rad.
--
-- Kanonisk regel (presisert):
--   - Tenant MED billingprofil = global modell → markedet MÅ være ACTIVE
--     i market_approvals (fail-closed, uendret).
--   - Tenant UTEN billingprofil = legacy (pre-global) → vokteren slipper
--     gjennom; den KANONISKE globale skrivebanen feiler uansett lukket
--     tidligere (lp_invoice_build_draft krever billingprofil/valuta), og
--     ikke-norske markeder kan ikke fakturere uten profil.
--   - Ingen NO-hardkoding: legacy-avgrensningen er datadrevet (profilfravær),
--     ikke landkode.

BEGIN;

CREATE OR REPLACE FUNCTION public.lp_invoice_market_activation_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
DECLARE
  v_country text;
  v_has_profile boolean;
BEGIN
  IF TG_TABLE_NAME = 'agreement_invoices' AND NEW.kind IS DISTINCT FROM 'INVOICE' THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'provider_commission_invoices' AND NEW.kind IS DISTINCT FROM 'COMMISSION' THEN
    RETURN NEW;
  END IF;

  SELECT true, m.country_code
  INTO v_has_profile, v_country
  FROM public.organization_billing_profiles obp
  JOIN public.markets m ON m.id = obp.market_id
  WHERE obp.organization_id = NEW.provider_id;

  -- Legacy tenant (pre-global, ingen billingprofil): kanonisk global
  -- skrivebane feiler lukket tidligere; legacy-generatorene er utenfor
  -- markedsgatens omfang.
  IF NOT coalesce(v_has_profile, false) THEN
    RETURN NEW;
  END IF;

  IF NOT public.lp_market_commercially_active(v_country) THEN
    RAISE EXCEPTION 'MARKET_NOT_COMMERCIALLY_APPROVED: %', v_country;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
