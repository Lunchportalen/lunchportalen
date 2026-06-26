-- G5d.3b — provider menu profile runtime mapping drafts (metadata/snapshot only).
--
-- Scope: migration + RLS only. No API, UI, publish, order, week, or Sanity wiring.
-- Rollback (non-destructive):
--   DROP TABLE IF EXISTS public.provider_menu_profile_runtime_mapping_drafts;

CREATE TABLE IF NOT EXISTS public.provider_menu_profile_runtime_mapping_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  menu_profile_id text NOT NULL,
  mapping_version text NOT NULL,
  source_profile_version text NULL,
  draft_status text NOT NULL DEFAULT 'draft',
  mapping_json jsonb NOT NULL,
  unmapped_categories_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  warm_dish_preview_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  validation_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text NULL,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  updated_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz NULL,
  CONSTRAINT provider_menu_profile_runtime_mapping_drafts_status_chk
    CHECK (draft_status IN ('draft', 'reviewed', 'archived')),
  CONSTRAINT provider_menu_profile_runtime_mapping_drafts_menu_profile_id_chk
    CHECK (
      menu_profile_id IN (
        'norwegian_company_lunch',
        'swedish_lunch',
        'danish_office_lunch',
        'finnish_office_lunch',
        'german_business_lunch',
        'french_dejeuner',
        'spanish_menu_del_dia',
        'uk_office_lunch',
        'italian_office_lunch'
      )
    ),
  CONSTRAINT provider_menu_profile_runtime_mapping_drafts_mapping_version_len_chk
    CHECK (char_length(trim(mapping_version)) > 0),
  CONSTRAINT provider_menu_profile_runtime_mapping_drafts_mapping_json_obj_chk
    CHECK (jsonb_typeof(mapping_json) = 'object'),
  CONSTRAINT provider_menu_profile_runtime_mapping_drafts_unmapped_arr_chk
    CHECK (jsonb_typeof(unmapped_categories_json) = 'array'),
  CONSTRAINT provider_menu_profile_runtime_mapping_drafts_warm_dish_arr_chk
    CHECK (jsonb_typeof(warm_dish_preview_json) = 'array'),
  CONSTRAINT provider_menu_profile_runtime_mapping_drafts_validation_obj_chk
    CHECK (jsonb_typeof(validation_summary_json) = 'object'),
  CONSTRAINT provider_menu_profile_runtime_mapping_drafts_archived_at_chk
    CHECK (
      (draft_status = 'archived' AND archived_at IS NOT NULL)
      OR (draft_status <> 'archived' AND archived_at IS NULL)
    )
);

COMMENT ON TABLE public.provider_menu_profile_runtime_mapping_drafts IS
  'G5d.3 staging-only mapping proposal snapshots. Not read by publish/order/week/Sanity runtime.';

COMMENT ON COLUMN public.provider_menu_profile_runtime_mapping_drafts.mapping_json IS
  'Shadow/proposal snapshot (G5d.2 view model). Must not enable runtime cutover at rest.';

CREATE INDEX IF NOT EXISTS provider_menu_profile_runtime_mapping_drafts_provider_id_idx
  ON public.provider_menu_profile_runtime_mapping_drafts (provider_id);

CREATE INDEX IF NOT EXISTS provider_menu_profile_runtime_mapping_drafts_provider_profile_idx
  ON public.provider_menu_profile_runtime_mapping_drafts (provider_id, menu_profile_id);

CREATE INDEX IF NOT EXISTS provider_menu_profile_runtime_mapping_drafts_provider_status_idx
  ON public.provider_menu_profile_runtime_mapping_drafts (provider_id, draft_status);

CREATE INDEX IF NOT EXISTS provider_menu_profile_runtime_mapping_drafts_updated_at_idx
  ON public.provider_menu_profile_runtime_mapping_drafts (updated_at DESC);

CREATE INDEX IF NOT EXISTS provider_menu_profile_runtime_mapping_drafts_active_idx
  ON public.provider_menu_profile_runtime_mapping_drafts (provider_id, menu_profile_id, updated_at DESC)
  WHERE draft_status <> 'archived';

DO $$
BEGIN
  IF to_regprocedure('public.tg_set_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS provider_menu_profile_runtime_mapping_drafts_set_updated_at
      ON public.provider_menu_profile_runtime_mapping_drafts;
    CREATE TRIGGER provider_menu_profile_runtime_mapping_drafts_set_updated_at
      BEFORE UPDATE ON public.provider_menu_profile_runtime_mapping_drafts
      FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
  END IF;
END
$$;

ALTER TABLE public.provider_menu_profile_runtime_mapping_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS provider_menu_profile_runtime_mapping_drafts_service_role_all
  ON public.provider_menu_profile_runtime_mapping_drafts;
CREATE POLICY provider_menu_profile_runtime_mapping_drafts_service_role_all
  ON public.provider_menu_profile_runtime_mapping_drafts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS provider_menu_profile_runtime_mapping_drafts_superadmin_all
  ON public.provider_menu_profile_runtime_mapping_drafts;
CREATE POLICY provider_menu_profile_runtime_mapping_drafts_superadmin_all
  ON public.provider_menu_profile_runtime_mapping_drafts
  FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

DROP POLICY IF EXISTS provider_menu_profile_runtime_mapping_drafts_select_provider_scope
  ON public.provider_menu_profile_runtime_mapping_drafts;
CREATE POLICY provider_menu_profile_runtime_mapping_drafts_select_provider_scope
  ON public.provider_menu_profile_runtime_mapping_drafts
  FOR SELECT
  TO authenticated
  USING (public.can_access_provider(provider_id));

DROP POLICY IF EXISTS provider_menu_profile_runtime_mapping_drafts_insert_provider_admin
  ON public.provider_menu_profile_runtime_mapping_drafts;
CREATE POLICY provider_menu_profile_runtime_mapping_drafts_insert_provider_admin
  ON public.provider_menu_profile_runtime_mapping_drafts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = provider_menu_profile_runtime_mapping_drafts.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
    AND created_by = auth.uid()
    AND updated_by = auth.uid()
  );

DROP POLICY IF EXISTS provider_menu_profile_runtime_mapping_drafts_update_provider_admin
  ON public.provider_menu_profile_runtime_mapping_drafts;
CREATE POLICY provider_menu_profile_runtime_mapping_drafts_update_provider_admin
  ON public.provider_menu_profile_runtime_mapping_drafts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = provider_menu_profile_runtime_mapping_drafts.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.provider_memberships pm
      WHERE pm.user_id = auth.uid()
        AND pm.provider_id = provider_menu_profile_runtime_mapping_drafts.provider_id
        AND pm.role = 'provider_admin'::public.provider_role
    )
    AND updated_by = auth.uid()
  );

REVOKE ALL ON TABLE public.provider_menu_profile_runtime_mapping_drafts FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON TABLE public.provider_menu_profile_runtime_mapping_drafts TO authenticated;
GRANT ALL ON TABLE public.provider_menu_profile_runtime_mapping_drafts TO service_role;
