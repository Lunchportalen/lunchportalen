-- Migration: Covering index for FK orders_agreement_scope_fk (agreement_id, company_id, location_id → agreements).
-- Source: Performance Advisor Rev A baseline (commit 5357d516); fresh advisor unindexed_foreign_keys (2026-05-18).
-- Hot-path: docs/hot-paths.md — order placement and agreement-bound reads.
-- Applied to prod via MCP; filename version matches public.schema_migrations (MCP-assigned).

CREATE INDEX IF NOT EXISTS ix_orders_agreement_id_company_id_location_id
  ON public.orders (agreement_id, company_id, location_id);
