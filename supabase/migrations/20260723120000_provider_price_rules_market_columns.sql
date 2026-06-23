-- R4B — Additive market-ready metadata on provider_price_rules (ADR-017).
-- Scope: columns + CHECK constraints + read-only compatibility view.
-- Does NOT: change unique index, seed ON CONFLICT, RLS, or runtime resolver.
-- Unique index / seed market_code alignment deferred to R4C.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Market-ready metadata columns (DEFAULT backfills existing rows)
-- ---------------------------------------------------------------------------
ALTER TABLE public.provider_price_rules
  ADD COLUMN IF NOT EXISTS market_code text NOT NULL DEFAULT 'NO',
  ADD COLUMN IF NOT EXISTS tax_basis text NOT NULL DEFAULT 'ex_tax',
  ADD COLUMN IF NOT EXISTS tax_category text NOT NULL DEFAULT 'food_catering',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'seed',
  ADD COLUMN IF NOT EXISTS created_by uuid NULL,
  ADD COLUMN IF NOT EXISTS updated_by uuid NULL;

COMMENT ON COLUMN public.provider_price_rules.market_code IS
  'R4B market scope (ADR-017). Default NO. Not used by production resolver until R4D+.';

COMMENT ON COLUMN public.provider_price_rules.tax_basis IS
  'R4B tax display basis: ex_tax | inc_tax | unknown. Not runtime-active until later R4 phase.';

COMMENT ON COLUMN public.provider_price_rules.tax_category IS
  'R4B tax category hint (e.g. food_catering). Not runtime-active until later R4 phase.';

COMMENT ON COLUMN public.provider_price_rules.source IS
  'R4B provenance: seed | admin | import | system. Audit metadata only in R4B.';

-- ---------------------------------------------------------------------------
-- 2) CHECK constraints (idempotent)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'provider_price_rules_market_code_chk'
      AND conrelid = 'public.provider_price_rules'::regclass
  ) THEN
    ALTER TABLE public.provider_price_rules
      ADD CONSTRAINT provider_price_rules_market_code_chk
      CHECK (market_code IN ('NO', 'SE', 'DK', 'FI', 'DE', 'FR', 'ES', 'UK'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'provider_price_rules_tax_basis_chk'
      AND conrelid = 'public.provider_price_rules'::regclass
  ) THEN
    ALTER TABLE public.provider_price_rules
      ADD CONSTRAINT provider_price_rules_tax_basis_chk
      CHECK (tax_basis IN ('ex_tax', 'inc_tax', 'unknown'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'provider_price_rules_source_chk'
      AND conrelid = 'public.provider_price_rules'::regclass
  ) THEN
    ALTER TABLE public.provider_price_rules
      ADD CONSTRAINT provider_price_rules_source_chk
      CHECK (source IN ('seed', 'admin', 'import', 'system'));
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 3) Compatibility view — NO tier defaults (not wired to runtime in R4B)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.provider_price_rules_tier_defaults_v1
  WITH (security_invoker = true) AS
SELECT
  id,
  provider_id,
  tier,
  amount_ex_vat,
  currency,
  vat_rate,
  is_active,
  valid_from,
  valid_to
FROM public.provider_price_rules
WHERE market_code = 'NO'
  AND customer_id IS NULL
  AND agreement_id IS NULL
  AND tier IS NOT NULL
  AND is_active = true;

COMMENT ON VIEW public.provider_price_rules_tier_defaults_v1 IS
  'R4B read-only NO tier-default price projection. For R4D preview/testing only — not used by loadProviderMenuPrices() until explicit cutover.';

-- ---------------------------------------------------------------------------
-- 4) Grants (mirror table: authenticated + service_role SELECT; no anon)
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.provider_price_rules_tier_defaults_v1 TO authenticated;
GRANT SELECT ON public.provider_price_rules_tier_defaults_v1 TO service_role;

COMMIT;
