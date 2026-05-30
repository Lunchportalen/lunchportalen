-- Migration: Covering index for FK location_memberships_user_company_fk (user_id, company_id → company_memberships).
-- Source: Performance Advisor Rev A baseline (commit 5357d516); fresh advisor unindexed_foreign_keys (2026-05-18).
-- Hot-path: docs/hot-paths.md — membership bridge; related to auth scope and tenant isolation.
-- Applied to prod via MCP; filename version matches public.schema_migrations (MCP-assigned).

CREATE INDEX IF NOT EXISTS ix_location_memberships_user_id_company_id
  ON public.location_memberships (user_id, company_id);
