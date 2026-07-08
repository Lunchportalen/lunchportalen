-- R4C — Market-scoped tier-default uniqueness on provider_price_rules (ADR-017).
-- Replaces legacy (provider_id, tier) unique index with (provider_id, market_code, tier).
-- Supplement/repair Melhus seed with explicit market metadata + new ON CONFLICT.
-- Does NOT: change RLS, view, runtime resolver, or foundation migration.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Preflight — fail closed on duplicate active tier defaults
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_dup_count int;
BEGIN
  SELECT COUNT(*)::int
  INTO v_dup_count
  FROM (
    SELECT provider_id, market_code, tier, COUNT(*) AS c
    FROM public.provider_price_rules
    WHERE customer_id IS NULL
      AND agreement_id IS NULL
      AND menu_category_key IS NULL
      AND menu_item_id IS NULL
      AND tier IS NOT NULL
      AND is_active = true
    GROUP BY provider_id, market_code, tier
    HAVING COUNT(*) > 1
  ) d;

  IF v_dup_count > 0 THEN
    RAISE EXCEPTION
      'R4C_PROVIDER_PRICE_RULES_DUPLICATE: % duplicate active tier-default group(s) for (provider_id, market_code, tier)',
      v_dup_count;
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2) New market-scoped unique index (tier defaults only)
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS provider_price_rules_provider_market_tier_default_uniq
  ON public.provider_price_rules (provider_id, market_code, tier)
  WHERE customer_id IS NULL
    AND agreement_id IS NULL
    AND menu_category_key IS NULL
    AND menu_item_id IS NULL
    AND tier IS NOT NULL
    AND is_active = true;

COMMENT ON INDEX public.provider_price_rules_provider_market_tier_default_uniq IS
  'R4C market-scoped tier-default uniqueness (provider_id, market_code, tier). Replaces legacy provider_tier_default_uniq for multi-market readiness. Runtime resolver unchanged until R4D+.';

-- ---------------------------------------------------------------------------
-- 3) Drop legacy unique index (provider_id, tier) without market_code
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS public.provider_price_rules_provider_tier_default_uniq;

-- ---------------------------------------------------------------------------
-- 4) Supplement/repair Melhus seed (idempotent; DO NOTHING on conflict)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_provider_id uuid;
BEGIN
  SELECT p.id
  INTO v_provider_id
  FROM public.providers p
  WHERE p.slug = 'melhus-catering'
    AND p.deleted_at IS NULL
    AND p.status = 'ACTIVE'::public.provider_status
  LIMIT 1;

  IF v_provider_id IS NULL THEN
    SELECT p.id
    INTO v_provider_id
    FROM public.providers p
    WHERE p.name = 'Melhus Catering AS'
      AND p.deleted_at IS NULL
      AND p.status = 'ACTIVE'::public.provider_status
    ORDER BY p.created_at ASC
    LIMIT 1;
  END IF;

  IF v_provider_id IS NULL THEN
    RAISE NOTICE
      'provider_price_rules_market_unique_index: Melhus Catering AS (slug melhus-catering) not found in public.providers; skipping optional local seed';
    RETURN;
  END IF;

  INSERT INTO public.provider_price_rules (
    provider_id,
    market_code,
    tier,
    package_key,
    amount_ex_vat,
    currency,
    vat_rate,
    tax_basis,
    tax_category,
    source,
    is_active
  )
  VALUES
    (v_provider_id, 'NO', 'BASIS', 'BASIS', 90, 'NOK', 0.15, 'ex_tax', 'food_catering', 'seed', true),
    (v_provider_id, 'NO', 'LUXUS', 'LUXUS', 130, 'NOK', 0.15, 'ex_tax', 'food_catering', 'seed', true),
    (v_provider_id, 'NO', 'ENTERPRISE', 'ENTERPRISE', 170, 'NOK', 0.15, 'ex_tax', 'food_catering', 'seed', true)
  ON CONFLICT (provider_id, market_code, tier)
    WHERE customer_id IS NULL
      AND agreement_id IS NULL
      AND menu_category_key IS NULL
      AND menu_item_id IS NULL
      AND tier IS NOT NULL
      AND is_active = true
  DO NOTHING;
END
$$;

COMMIT;
