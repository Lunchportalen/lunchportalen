-- Migration: Covering index for FK location_memberships_company_location_fk (company_id, location_id → company_locations).
-- Source: Performance Advisor Rev A baseline (commit 5357d516); fresh advisor unindexed_foreign_keys (2026-05-18).
-- Hot-path: docs/hot-paths.md — multi-location / membership (related to operational scope).
-- Applied to prod via MCP; filename version matches public.schema_migrations (MCP-assigned).

CREATE INDEX IF NOT EXISTS ix_location_memberships_company_id_location_id
  ON public.location_memberships (company_id, location_id);
