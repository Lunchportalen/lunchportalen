-- PHASE 11 — SUPERADMIN NORWEGIAN TRANSLATION LAYER (additive).
--
-- Lar superadmin håndtere utenlandsk innhold (registreringer, avtaler,
-- meldinger, fritekst) PÅ NORSK, uten å miste originalen:
--   - originalspråk + originaltekst er IMMUTABLE (append-only per hash)
--   - norsk oversettelse med kilde (none/machine/manual)
--   - maskinoversettelse er ALLTID kun utkast (review_state=machine_draft)
--   - confidence + review-tilstand + tidsstempler + append-only hendelseslogg
--   - side-ved-side-visning skjer i superadminflaten
--
-- Oversettes ALDRI (håndheves i app-laget ved maskering, dokumentert her):
-- juridiske identifikatorer, firmanavn, fakturanumre, beløp, valutakoder,
-- kanoniske statuser og audit-ID-er.

BEGIN;

CREATE TABLE IF NOT EXISTS public.superadmin_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (
    entity_type IN ('provider_registration', 'company_registration', 'agreement', 'message', 'freetext')
  ),
  entity_id uuid NOT NULL,
  field_name text NOT NULL,
  original_language text NOT NULL CHECK (original_language ~ '^[a-z]{2}$'),
  original_text text NOT NULL,
  original_text_hash text NOT NULL,
  translated_text_nb text,
  translation_source text NOT NULL DEFAULT 'none' CHECK (translation_source IN ('none', 'machine', 'manual')),
  review_state text NOT NULL DEFAULT 'pending' CHECK (
    review_state IN ('pending', 'machine_draft', 'reviewed', 'approved')
  ),
  confidence numeric CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  translated_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT superadmin_translations_entity_field_hash_uniq UNIQUE (entity_type, entity_id, field_name, original_text_hash),
  -- Maskinoversettelse kan aldri stå som godkjent uten menneskelig review.
  CONSTRAINT superadmin_translations_machine_draft_chk CHECK (
    NOT (translation_source = 'machine' AND review_state = 'approved' AND reviewed_by IS NULL)
  )
);

COMMENT ON TABLE public.superadmin_translations IS
  'Norwegian control-language layer for foreign content. Original text/language are immutable; machine translation is draft-only; approval requires a human reviewer. Never used in tenant-facing flows.';

CREATE INDEX IF NOT EXISTS superadmin_translations_entity_idx
  ON public.superadmin_translations (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS superadmin_translations_review_idx
  ON public.superadmin_translations (review_state, created_at DESC);

-- Original er immutabel; kun oversettelses-/reviewfeltene kan endres.
CREATE OR REPLACE FUNCTION public.lp_superadmin_translations_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  IF OLD.entity_type IS DISTINCT FROM NEW.entity_type
     OR OLD.entity_id IS DISTINCT FROM NEW.entity_id
     OR OLD.field_name IS DISTINCT FROM NEW.field_name
     OR OLD.original_language IS DISTINCT FROM NEW.original_language
     OR OLD.original_text IS DISTINCT FROM NEW.original_text
     OR OLD.original_text_hash IS DISTINCT FROM NEW.original_text_hash
     OR OLD.created_at IS DISTINCT FROM NEW.created_at
  THEN
    RAISE EXCEPTION 'superadmin_translations original content is immutable';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS superadmin_translations_guard ON public.superadmin_translations;
CREATE TRIGGER superadmin_translations_guard
  BEFORE UPDATE ON public.superadmin_translations
  FOR EACH ROW EXECUTE FUNCTION public.lp_superadmin_translations_guard();

-- Append-only hendelseslogg (audit for oversettelsesarbeidet).
CREATE TABLE IF NOT EXISTS public.superadmin_translation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  translation_id uuid NOT NULL REFERENCES public.superadmin_translations(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('created', 'machine_translated', 'manually_translated', 'reviewed', 'approved')),
  actor_user_id uuid,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS superadmin_translation_events_translation_idx
  ON public.superadmin_translation_events (translation_id, created_at);

CREATE OR REPLACE FUNCTION public.lp_superadmin_translation_events_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public
AS $$
BEGIN
  RAISE EXCEPTION 'superadmin_translation_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS superadmin_translation_events_no_update ON public.superadmin_translation_events;
CREATE TRIGGER superadmin_translation_events_no_update
  BEFORE UPDATE OR DELETE ON public.superadmin_translation_events
  FOR EACH ROW EXECUTE FUNCTION public.lp_superadmin_translation_events_immutable();

-- RLS: plattform-admin lesetilgang; all skriving via service_role (API-laget).
ALTER TABLE public.superadmin_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.superadmin_translation_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.superadmin_translations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.superadmin_translation_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.superadmin_translations TO authenticated;
GRANT SELECT ON TABLE public.superadmin_translation_events TO authenticated;
GRANT ALL ON TABLE public.superadmin_translations TO service_role;
GRANT ALL ON TABLE public.superadmin_translation_events TO service_role;

DROP POLICY IF EXISTS superadmin_translations_platform_admin_read ON public.superadmin_translations;
CREATE POLICY superadmin_translations_platform_admin_read
  ON public.superadmin_translations FOR SELECT TO authenticated
  USING (public.is_platform_admin());

DROP POLICY IF EXISTS superadmin_translation_events_platform_admin_read ON public.superadmin_translation_events;
CREATE POLICY superadmin_translation_events_platform_admin_read
  ON public.superadmin_translation_events FOR SELECT TO authenticated
  USING (public.is_platform_admin());

COMMIT;
