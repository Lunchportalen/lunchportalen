-- SMART-1 — provider-approved menu content translations (storage + RLS only).
--
-- Scope: migration + RLS only. No API, UI, /week, order write, or employee overlay runtime.
-- Sanity remains original text source; Postgres stores approval workflow state.
-- Rollback (non-destructive):
--   DROP TABLE IF EXISTS public.menu_content_translations;

CREATE TABLE IF NOT EXISTS public.menu_content_translations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  source_ref text NOT NULL,
  field text NOT NULL,
  locale text NOT NULL,
  original_text text NOT NULL,
  original_text_hash text NOT NULL,
  translated_text text NULL,
  status text NOT NULL DEFAULT 'missing',
  approved_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT menu_content_translations_source_kind_chk
    CHECK (source_kind IN ('menu_day', 'menu_day_item', 'category_label', 'allergen_label')),
  CONSTRAINT menu_content_translations_field_chk
    CHECK (field IN ('title', 'description', 'label')),
  CONSTRAINT menu_content_translations_status_chk
    CHECK (status IN ('missing', 'draft', 'suggested', 'approved', 'rejected', 'stale')),
  CONSTRAINT menu_content_translations_locale_chk
    CHECK (
      locale IN ('nb', 'en', 'sv', 'da', 'fi', 'de', 'fr', 'es', 'it')
    ),
  CONSTRAINT menu_content_translations_source_ref_len_chk
    CHECK (char_length(trim(source_ref)) > 0),
  CONSTRAINT menu_content_translations_original_text_len_chk
    CHECK (char_length(trim(original_text)) > 0),
  CONSTRAINT menu_content_translations_original_text_hash_len_chk
    CHECK (char_length(trim(original_text_hash)) > 0),
  CONSTRAINT menu_content_translations_provider_source_field_locale_uniq
    UNIQUE (provider_id, source_kind, source_ref, field, locale),
  CONSTRAINT menu_content_translations_approved_at_chk
    CHECK (
      (status = 'approved' AND approved_at IS NOT NULL)
      OR (status <> 'approved' AND approved_at IS NULL)
    ),
  CONSTRAINT menu_content_translations_approved_by_chk
    CHECK (
      (status = 'approved' AND approved_by IS NOT NULL)
      OR (status <> 'approved' AND approved_by IS NULL)
    )
);

COMMENT ON TABLE public.menu_content_translations IS
  'SMART-1 provider-approved menu translation overlays. Not read by employee runtime; future SMART-3 server read model only.';

COMMENT ON COLUMN public.menu_content_translations.original_text_hash IS
  'Hash snapshot of original_text at provider edit/approval time. Mismatch => mark stale; employee sees Sanity original until reapproved.';

COMMENT ON COLUMN public.menu_content_translations.status IS
  'Workflow state. Only approved + hash match may become employee-visible via future server overlay (never direct table access).';

CREATE INDEX IF NOT EXISTS menu_content_translations_provider_id_idx
  ON public.menu_content_translations (provider_id);

CREATE INDEX IF NOT EXISTS menu_content_translations_provider_locale_status_idx
  ON public.menu_content_translations (provider_id, locale, status);

CREATE INDEX IF NOT EXISTS menu_content_translations_provider_source_ref_idx
  ON public.menu_content_translations (provider_id, source_kind, source_ref);

CREATE INDEX IF NOT EXISTS menu_content_translations_approved_lookup_idx
  ON public.menu_content_translations (provider_id, locale, status)
  WHERE status = 'approved';

DO $$
BEGIN
  IF to_regprocedure('public.tg_set_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS menu_content_translations_set_updated_at
      ON public.menu_content_translations;
    CREATE TRIGGER menu_content_translations_set_updated_at
      BEFORE UPDATE ON public.menu_content_translations
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END
$$;

ALTER TABLE public.menu_content_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_content_translations_service_role_all
  ON public.menu_content_translations;
CREATE POLICY menu_content_translations_service_role_all
  ON public.menu_content_translations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS menu_content_translations_superadmin_all
  ON public.menu_content_translations;
CREATE POLICY menu_content_translations_superadmin_all
  ON public.menu_content_translations
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS menu_content_translations_select_provider_scope
  ON public.menu_content_translations;
CREATE POLICY menu_content_translations_select_provider_scope
  ON public.menu_content_translations
  FOR SELECT
  TO authenticated
  USING (public.can_access_provider(provider_id));

DROP POLICY IF EXISTS menu_content_translations_insert_provider_admin
  ON public.menu_content_translations;
CREATE POLICY menu_content_translations_insert_provider_admin
  ON public.menu_content_translations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = menu_content_translations.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
  );

DROP POLICY IF EXISTS menu_content_translations_update_provider_admin
  ON public.menu_content_translations;
CREATE POLICY menu_content_translations_update_provider_admin
  ON public.menu_content_translations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = menu_content_translations.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = menu_content_translations.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
  );

REVOKE ALL ON TABLE public.menu_content_translations FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.menu_content_translations TO authenticated;
GRANT ALL ON TABLE public.menu_content_translations TO service_role;
