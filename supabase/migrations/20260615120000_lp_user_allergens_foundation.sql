-- lp_user_allergens: per-employee allergen profile (art. 9 health data) for kitchen extra info.
-- NOT menu/rett-allergens (Sanity). Idempotent for uigx re-apply after ledger repair.

DO $$
BEGIN
  CREATE TYPE public.lp_allergen_code AS ENUM (
    'gluten',
    'crustaceans',
    'egg',
    'fish',
    'peanuts',
    'soy',
    'milk',
    'tree_nuts',
    'celery',
    'mustard',
    'sesame',
    'sulphites',
    'lupin',
    'molluscs'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.lp_user_allergens (
  user_id uuid NOT NULL,
  codes public.lp_allergen_code[] NOT NULL DEFAULT '{}'::public.lp_allergen_code[],
  free_text text NOT NULL DEFAULT ''::text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT lp_user_allergens_pkey PRIMARY KEY (user_id),
  CONSTRAINT lp_user_allergens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles (id) ON DELETE CASCADE,
  CONSTRAINT lp_user_allergens_free_text_len CHECK (char_length(coalesce(free_text, '')) <= 280)
);

CREATE INDEX IF NOT EXISTS lp_user_allergens_updated_at_idx ON public.lp_user_allergens (updated_at DESC);

COMMENT ON TABLE public.lp_user_allergens IS 'Employee-declared allergen profile (kitchen extra info). Not Sanity menu allergens.';
COMMENT ON COLUMN public.lp_user_allergens.codes IS 'EU-14 style codes; labels live in app constants.';
COMMENT ON COLUMN public.lp_user_allergens.free_text IS 'Optional kitchen-visible note; max 280 chars; never log in audit/Sentry.';

-- Kitchen read scope mirrors orders: can_kitchen_location on employee profile location.
CREATE OR REPLACE FUNCTION public.kitchen_can_read_lp_user_allergen(p_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_target_user_id
      AND p.location_id IS NOT NULL
      AND public.can_kitchen_location(p.location_id)
  );
$$;

REVOKE ALL ON FUNCTION public.kitchen_can_read_lp_user_allergen(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.kitchen_can_read_lp_user_allergen(uuid) TO authenticated;

ALTER TABLE public.lp_user_allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lp_user_allergens FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.lp_user_allergens FROM PUBLIC;
REVOKE ALL ON TABLE public.lp_user_allergens FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.lp_user_allergens TO authenticated;
GRANT ALL ON TABLE public.lp_user_allergens TO service_role;

DROP POLICY IF EXISTS lp_user_allergens_self_select ON public.lp_user_allergens;
CREATE POLICY lp_user_allergens_self_select ON public.lp_user_allergens
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS lp_user_allergens_self_insert ON public.lp_user_allergens;
CREATE POLICY lp_user_allergens_self_insert ON public.lp_user_allergens
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS lp_user_allergens_self_update ON public.lp_user_allergens;
CREATE POLICY lp_user_allergens_self_update ON public.lp_user_allergens
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS lp_user_allergens_self_delete ON public.lp_user_allergens;
CREATE POLICY lp_user_allergens_self_delete ON public.lp_user_allergens
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS lp_user_allergens_kitchen_select ON public.lp_user_allergens;
CREATE POLICY lp_user_allergens_kitchen_select ON public.lp_user_allergens
  FOR SELECT TO authenticated
  USING (public.kitchen_can_read_lp_user_allergen(user_id));
