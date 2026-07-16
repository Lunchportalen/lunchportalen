-- PHASE 13 — orders currency truth per provider-marked (global defekt funnet
-- under 21-lands RC-beviset).
--
-- Protected Golden Path Impact: JA — ny BEFORE INSERT-trigger på public.orders.
--   - Root cause: lp_order_set setter aldri currency_code; kolonnen hadde
--     DEFAULT 'NOK'. Ordre i EUR/GBP/USD/…-markeder fikk dermed feil valuta i
--     ordre, ordresnapshots, fakturalinjer og provisjonsledger.
--   - Fix: DEFAULT fjernes; valuta hydreres deterministisk fra
--     provider_settings.default_currency → organization_billing_profiles.
--     billing_currency → agreements.currency (aldri hardkodet fallback;
--     fail-closed hvis ingen kilde finnes).
--   - Norsk produksjon er uendret: alle kildene er NOK for norske tenants.
--   - lp_order_set selv er IKKE endret. Replica-seeds (tester) setter valuta
--     eksplisitt og påvirkes ikke (triggere er av i replica-modus).
--   - Regresjon: test:golden-path + orders-idempotency + churn-suiten kjørt
--     grønt etter endringen (se Fase 13-manifest).

BEGIN;

ALTER TABLE public.orders ALTER COLUMN currency_code DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.tg_orders_currency_market_truth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_currency text;
BEGIN
  IF nullif(trim(coalesce(NEW.currency_code, '')), '') IS NOT NULL THEN
    RETURN NEW; -- eksplisitt valuta respekteres alltid
  END IF;

  SELECT coalesce(
    nullif(trim(ps.default_currency), ''),
    nullif(trim(obp.billing_currency), '')
  )
  INTO v_currency
  FROM public.providers p
  LEFT JOIN public.provider_settings ps ON ps.provider_id = p.id
  LEFT JOIN public.organization_billing_profiles obp ON obp.organization_id = p.id
  WHERE p.id = NEW.provider_id;

  IF v_currency IS NULL AND NEW.agreement_id IS NOT NULL THEN
    SELECT nullif(trim(a.currency), '') INTO v_currency
    FROM public.agreements a WHERE a.id = NEW.agreement_id;
  END IF;

  IF v_currency IS NULL THEN
    RAISE EXCEPTION 'ORDER_CURRENCY_UNRESOLVABLE' USING errcode = 'P0001';
  END IF;

  NEW.currency_code := upper(v_currency);
  RETURN NEW;
END;
$$;

-- Kjøres ETTER a0_orders_hydrate_core_fields (alfabetisk rekkefølge),
-- slik at provider_id/agreement_id allerede er hydrert.
DROP TRIGGER IF EXISTS a1_orders_currency_market_truth ON public.orders;
CREATE TRIGGER a1_orders_currency_market_truth
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.tg_orders_currency_market_truth();

COMMENT ON TRIGGER a1_orders_currency_market_truth ON public.orders IS
  'Currency truth: orders inherit provider market currency (provider_settings → billing profile → agreement). No hardcoded fallback; explicit values always win.';

COMMIT;
