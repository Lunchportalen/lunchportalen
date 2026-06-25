-- ADR-019 G2: additive menu_profile_id on provider_settings (nullable, inert until runtime wiring).
--
-- Rollback (non-destructive):
--   ALTER TABLE public.provider_settings DROP CONSTRAINT IF EXISTS provider_settings_menu_profile_id_check;
--   ALTER TABLE public.provider_settings DROP COLUMN IF EXISTS menu_profile_id;
--
-- RLS: intentionally unchanged. Existing provider_settings row policies cover the new column
-- (select via app_active_org()/platform admin, write via platform admin or service_role).
-- No backfill — existing rows remain NULL and behave as today.

ALTER TABLE public.provider_settings
  ADD COLUMN IF NOT EXISTS menu_profile_id text;

COMMENT ON COLUMN public.provider_settings.menu_profile_id IS
  'Optional MenuProfile registry id (ADR-019). NULL = legacy behavior until resolver wiring. Not read at runtime in G2.';

ALTER TABLE public.provider_settings
  DROP CONSTRAINT IF EXISTS provider_settings_menu_profile_id_check;

ALTER TABLE public.provider_settings
  ADD CONSTRAINT provider_settings_menu_profile_id_check
  CHECK (
    menu_profile_id IS NULL
    OR menu_profile_id IN (
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
  );
