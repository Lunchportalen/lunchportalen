-- GLOBAL RELEASE GATE (Fase F/L): complete market configuration rows.
-- Additive only. Adds per-market VAT (food/catering), cutoff local time,
-- invoice language and Stripe readiness status; activates all seeded markets.
--
-- VAT seeds are catering/served-food defaults per country and MUST be
-- commercially/legally reviewed before first invoice in each market
-- (tracked in docs/GLOBAL-LAUNCH-MATRIX.md). US uses sales-tax regime => 0 here.

BEGIN;

ALTER TABLE public.markets
  ADD COLUMN IF NOT EXISTS vat_rate_food numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cutoff_local_time time NOT NULL DEFAULT time '08:00',
  ADD COLUMN IF NOT EXISTS invoice_language text,
  ADD COLUMN IF NOT EXISTS stripe_status text NOT NULL DEFAULT 'not_configured';

DO $$
BEGIN
  ALTER TABLE public.markets
    ADD CONSTRAINT markets_stripe_status_chk
    CHECK (stripe_status IN ('not_configured', 'test_mode', 'configured'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

COMMENT ON COLUMN public.markets.vat_rate_food IS
  'Catering/served food VAT percent (seed default — commercial/legal review required before invoicing in market).';
COMMENT ON COLUMN public.markets.cutoff_local_time IS
  'Order cutoff in the market local timezone (default 08:00). Used by lp_company_cutoff_context.';
COMMENT ON COLUMN public.markets.invoice_language IS
  'Invoice/document language for the market (app locale code).';
COMMENT ON COLUMN public.markets.stripe_status IS
  'Stripe rollout status per market: not_configured | test_mode | configured.';

-- Invoice language follows the market default UI language.
UPDATE public.markets SET invoice_language = default_language WHERE invoice_language IS NULL;

-- Catering/served-food VAT defaults per country (see column comment).
UPDATE public.markets SET vat_rate_food = v.rate
FROM (VALUES
  ('NO', 15.00), ('SE', 12.00), ('DK', 25.00), ('FI', 14.00),
  ('GB', 20.00), ('DE', 19.00), ('FR', 10.00), ('ES', 10.00),
  ('IT', 10.00), ('US', 0.00),  ('CA', 5.00),  ('NL', 9.00),
  ('BE', 12.00), ('AT', 10.00), ('CH', 8.10),  ('IE', 13.50),
  ('LU', 3.00),  ('AU', 10.00), ('SG', 9.00)
) AS v(country, rate)
WHERE markets.country_code = v.country;

-- Stripe: platform is configured for the NO launch market; others follow rollout.
UPDATE public.markets SET stripe_status = 'configured' WHERE country_code = 'NO';

-- Global launch: open all seeded markets (kill switches + company/agreement status
-- remain the operational stop levers; see docs/GLOBAL-LAUNCH-RUNBOOK.md).
UPDATE public.markets SET is_active = true, updated_at = now() WHERE is_active = false;

COMMIT;
