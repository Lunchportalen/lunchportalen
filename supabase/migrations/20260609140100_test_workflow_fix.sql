-- HOTFIX-C verifikasjon: tester at supabase-migrate.yml faktisk applyer migrasjoner
-- etter workflow-fix. Trygg å reapplye (idempotent COMMENT-update).

COMMENT ON FUNCTION public.tg_menu_service_day_defaults() IS
  'Sets provider_id from companies via company_locations.
   Fixed 2026-05-29 (incident: MSD provider_id NOT NULL).
   Workflow verified 2026-05-30 (HOTFIX-C).';
