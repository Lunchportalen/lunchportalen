-- Migration: Covering index for FK day_choices_location_id_fkey (location_id → company_locations).
-- Source: Performance Advisor Rev A baseline (commit 5357d516); fresh advisor unindexed_foreign_keys (2026-05-18).
-- Hot-path: docs/hot-paths.md — GET /api/order/window, bulk-set, cancel.
-- Applied to prod via MCP; filename version matches public.schema_migrations (MCP-assigned).

CREATE INDEX IF NOT EXISTS ix_day_choices_location_id
  ON public.day_choices (location_id);
