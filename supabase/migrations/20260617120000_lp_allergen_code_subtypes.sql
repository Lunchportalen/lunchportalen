-- lp_allergen_code FASE 2.1: Mattilsynet undertyper (gluten kornslag + nøttetyper).
-- Idempotent ADD VALUE IF NOT EXISTS. No RLS/table changes.
-- draft → uigx → prod (await explicit go).

ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'gluten_wheat';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'gluten_rye';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'gluten_barley';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'gluten_oats';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'gluten_spelt';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'gluten_kamut';

ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'nut_almond';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'nut_hazelnut';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'nut_walnut';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'nut_cashew';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'nut_pecan';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'nut_pistachio';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'nut_brazil';
ALTER TYPE public.lp_allergen_code ADD VALUE IF NOT EXISTS 'nut_macadamia';

COMMENT ON TYPE public.lp_allergen_code IS
  'EU-14 categories + Mattilsynet undertyper (gluten kornslag, nøttetyper). gluten/tree_nuts = uspesifisert.';
