# F4b MSDI Trigger Alignment — Production Apply Evidence

**Date:** 2026-07-10 (Europe/Oslo)  
**Status:** **APPLIED** — production DDL/trigger live; **no SOT start**; **no rematerialization**; Danish partial state **unchanged**

---

## 1. Scope

| Field | Value |
|---|---|
| Title | F4b MSDI localized SOT snapshot trigger alignment — production apply only |
| Scope | Supabase production DDL: `snapshot_mode` column + `tg_menu_service_day_item_snapshot` localized branch |
| Explicitly excluded | SOT cutover/start · auto-rollout · publish · generator apply · onboarding · Phase D · Sanity mutation · rematerialization · manual `menu_service_days`/`menu_service_day_items` writes · orders · billing/Stripe · production flag changes |
| Repo HEAD | `ae9ec929` — `feat(menu): align MSDI trigger for localized SOT snapshots (#479)` |
| Supabase project | `hkpokyapzarefrgqzkos` (production) |

---

## 2. Migration applied

| Field | Value |
|---|---|
| File | `supabase/migrations/20260810120000_msdi_localized_sot_snapshot_trigger_alignment.sql` |
| Ledger version | `20260810120000` |
| Ledger name | `msdi_localized_sot_snapshot_trigger_alignment` |
| Method | MCP `apply_migration` (surgical single-migration apply) |
| `supabase db push` | **Not used** — dry-run would include 12 additional billing/payment migrations (see §4) |

---

## 3. Production preflight (read-only)

### Migration ledger (before)

| Check | Result |
|---|---|
| Latest applied (prod) | `20260728120000` (`menu_content_translations`) |
| `20260810120000` present | **No** |
| `snapshot_mode` column | **Absent** |
| Trigger localized branch | **Absent** (`has_localized_branch=false`) |

### Row counts (before)

| Table | Count |
|---|---|
| `menu_service_days` | 79 |
| `menu_service_day_items` | 297 |
| `orders` (global) | 17 |
| Danish `menu_service_days` (`2031-11-03`) | 1 |

### Danish partial state (before)

```json
[
  {"offered_price_cents_ex_vat": 10500, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Paasmurt", "sort_order": 1},
  {"offered_price_cents_ex_vat": 10500, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Salatboks", "sort_order": 2},
  {"offered_price_cents_ex_vat": 10500, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Varmrett", "sort_order": 7}
]
```

### SOT / auto-rollout (before)

| Check | Result |
|---|---|
| `LP_LOCALIZED_GENERATOR_SOT_*` (Vercel production) | **Absent** |
| Auto-rollout flags | **OFF / absent** |

---

## 4. Apply command summary (no secrets)

1. **Preflight:** MCP `execute_sql` read-only against production (`hkpokyapzarefrgqzkos`).
2. **db push gate:** `supabase db push --dry-run` would apply **13** pending forward migrations:
   - `20260729120000` … `20260809120000` (billing/payment stack — **not authorized**)
   - `20260810120000` (F4b — **authorized**)
   - **Decision:** STOP full `db push`; apply F4b only via surgical MCP.
3. **Apply:** MCP `apply_migration` with name `msdi_localized_sot_snapshot_trigger_alignment` and SQL from repo migration (column + CHECK + `CREATE OR REPLACE FUNCTION tg_menu_service_day_item_snapshot` + column comment).
4. **Ledger align:** Replaced MCP drift version `20260710144103` with canonical git version `20260810120000` in `supabase_migrations.schema_migrations` (metadata-only; DDL already live).

---

## 5. Post-apply verification

| Check | Result |
|---|---|
| Ledger `20260810120000` | **Present** |
| MCP drift `20260710144103` | **Removed** |
| `snapshot_mode` column | **Present** (`text`, nullable) |
| Localized trigger branch | **Present** (`localized_generated_content`) |
| Legacy price coalesce | **Present** (`coalesce(new.offered_price_cents_ex_vat, v_price)`) |

---

## 6. Trigger/function verification

| Branch | Verified |
|---|---|
| Localized path (`snapshot_mode = localized_generated_content` + complete payload) | Preserves app-supplied `product_name_snapshot`, `unit_name_snapshot`, `vat_rate_snapshot`, `offered_price_cents_ex_vat` |
| Legacy path (NULL/incomplete mode) | Unchanged — overwrites from `products` catalog; price via `coalesce` |
| RLS | Unchanged (no policy edits in migration) |
| Order write-path / `lp_order_set` | Untouched |

---

## 7. Snapshot mode verification

| Check | Result |
|---|---|
| Column | `menu_service_day_items.snapshot_mode` exists |
| CHECK constraint | `NULL` or `localized_generated_content` only |
| Existing rows | All `snapshot_mode = NULL` (expected — no rematerialization) |

---

## 8. Row-count safety

| Table | Before | After | Delta |
|---|---|---|---|
| `menu_service_days` | 79 | 79 | 0 |
| `menu_service_day_items` | 297 | 297 | 0 |
| `orders` | 17 | 17 | 0 |

---

## 9. Danish partial state unchanged

Post-apply read-back (provider `799ba3a2-a127-48a0-87b7-87944a2f42a3`, `2031-11-03`, location `48668121-f189-404c-9a13-558b186c23b0`):

```json
[
  {"offered_price_cents_ex_vat": 10500, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Paasmurt", "snapshot_mode": null, "sort_order": 1},
  {"offered_price_cents_ex_vat": 10500, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Salatboks", "snapshot_mode": null, "sort_order": 2},
  {"offered_price_cents_ex_vat": 10500, "vat_rate_snapshot": "0.15", "product_name_snapshot": "Varmrett", "snapshot_mode": null, "sort_order": 7}
]
```

Names/VAT still tier-product snapshots until scoped re-cutover/rematerialization with SOT flags ON.

---

## 10. SOT flags OFF

| Check | Result |
|---|---|
| `LP_LOCALIZED_GENERATOR_SOT_ENABLED` | Absent (production Vercel) |
| `LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST` | Absent |
| `LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED` | Absent |

---

## 11. Auto-rollout OFF

No auto-rollout production flags present or changed.

---

## 12. No rematerialization

No publish, generator apply, Sanity webhook retrigger, or MSDI sync executed in this GO.

---

## 13. No orders changed

Global orders: **17** (unchanged). Danish orders: **0** (unchanged).

---

## 14. No billing changed

Billing/payment migrations `20260729120000`–`20260809120000` remain **unapplied** on production. No Stripe or invoice mutation in this GO.

---

## 15. Next required gate

**Scoped Danish F4b re-cutover verification GO** — one provider/date/tier only, explicit production mutation allowed, **no auto-rollout**, SOT flags must be explicitly enabled in a separate authorized session.

**Exact next GO prompt:**

```
GO scoped Danish F4b re-cutover verification — one provider/date/tier only, explicit production mutation allowed, no auto-rollout
```

---

## Local gates (post-apply)

| Gate | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run ci:commercial-hardcodes-guard` | PASS |
| `npm run test:golden-path` | PASS (103/103) |
| `vitest run tests/lib/menu-publish/msdiLocalizedSotSnapshotTriggerMigration.test.ts` | PASS (5/5) |
