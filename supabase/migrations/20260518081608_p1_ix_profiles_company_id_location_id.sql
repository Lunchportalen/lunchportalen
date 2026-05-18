-- Migration: Covering index for FK profiles_company_location_pair_fk (company_id, location_id → company_locations).
-- Source: Performance Advisor Rev A baseline (commit 5357d516); fresh advisor unindexed_foreign_keys (2026-05-18).
-- Hot-path: docs/hot-paths.md — profiles; kitchen, driver, admin, scope.
-- Applied to prod via MCP; filename version matches public.schema_migrations (MCP-assigned).

CREATE INDEX IF NOT EXISTS ix_profiles_company_id_location_id
  ON public.profiles (company_id, location_id);
