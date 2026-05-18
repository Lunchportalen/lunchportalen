-- Migration: Covering index for FK order_items_product_id_fkey (product_id → products).
-- Source: Performance Advisor Rev A baseline (commit 5357d516); fresh advisor unindexed_foreign_keys (2026-05-18).
-- Hot-path: docs/hot-paths.md — order line items (orders flow).
-- Applied to prod via MCP; filename version matches public.schema_migrations (MCP-assigned).

CREATE INDEX IF NOT EXISTS ix_order_items_product_id
  ON public.order_items (product_id);
