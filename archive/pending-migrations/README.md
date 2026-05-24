# Pending migrations (review before apply)

## `20260516140000_repair_lp_order_set_and_vat_rate_tolking.sql`

**Status:** Intended fix awaiting code review.

**Context:** `lp_order_set` on prod currently lacks `vat_rate` parameter normalization in the applied function definition (audit gap).

### Promotion path

1. Review SQL for correctness
2. Apply in staging via `supabase migration up`
3. Verify `lp_order_set` signature and behavior includes VAT decimal handling (`0.15`)
4. Promote to `supabase/migrations/` with **new** timestamp (at promotion time)
5. Apply in prod via standard migration pipeline

**DO NOT apply without review.**

Refs: post-audit PF.1 classification (2026-05-26), C-MIG-01 / order RPC hygiene.
