-- Migration: Covering index for FK orders_company_location_pair_fk (company_id, location_id → company_locations).
-- Source: Performance Advisor Rev A baseline (commit 5357d516); fresh advisor unindexed_foreign_keys (2026-05-18).
-- Hot-path: docs/hot-paths.md — orders APIs (week, today, my, kitchen, driver).
-- Applied to prod via MCP; filename version matches public.schema_migrations (MCP-assigned).

CREATE INDEX IF NOT EXISTS ix_orders_company_id_location_id
  ON public.orders (company_id, location_id);
