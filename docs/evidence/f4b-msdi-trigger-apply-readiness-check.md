# F4b MSDI Trigger Alignment — Production Apply Readiness Check

**Status:** Evidence archived · docs-only · **NOT READY for F4b production apply GO**
**Date:** 2026-07-10
**Main HEAD (audit):** `0b441692` — docs(menu): reconcile GO truth state (#481)
**Audit type:** Read-only. No migration apply. No SOT start. No auto-rollout. No production mutation.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

Read-only verification of whether production is ready for a **separate GO** to apply:

`supabase/migrations/20260810120000_msdi_localized_sot_snapshot_trigger_alignment.sql`

**Result:** Migration is **already applied** in production. A new production apply GO for F4b is **not applicable**.

---

## 2. Source verification

| Check | Result |
|-------|--------|
| PR #479 on main | **YES** — `ae9ec929` |
| PR #481 truth index on main | **YES** — `0b441692` |
| Migration file present | **YES** — `supabase/migrations/20260810120000_msdi_localized_sot_snapshot_trigger_alignment.sql` |
| Trigger function | `tg_menu_service_day_item_snapshot` — localized preserve branch when `snapshot_mode = localized_generated_content` and payload complete |
| Legacy behavior | Unchanged when `snapshot_mode` NULL or incomplete — tier-product resolution from `products` |
| Boundaries | No `UPDATE`/`DELETE` on data; no RLS changes; no `lp_order_set`/billing/orders in migration body |

---

## 3. Production ledger verification (read-only)

| Check | Result |
|-------|--------|
| Latest applied migration | **`20260810120000`** — `msdi_localized_sot_snapshot_trigger_alignment` |
| F4b already applied? | **YES** — present in `supabase_migrations.schema_migrations` |
| `snapshot_mode` column | **EXISTS** — `text NULL` on `menu_service_day_items` |
| Trigger localized branch | **PRESENT** — function body contains `localized_generated_content` + early `return new` |
| Pending repo migrations (not in production) | **11 billing migrations** between `20260729120000` and `20260809120000` — future bulk apply would **not** be F4b-only |

### Pending migrations in repo but NOT in production ledger

1. `20260729120000` — global_billing_engine_foundation
2. `20260730120000` — order_billing_snapshot_ledger_wiring
3. `20260731120000` — billing_readiness_observability
4. `20260801120000` — commission_correction_negative_ledger
5. `20260802120000` — payment_invoice_readiness_policy
6. `20260803120000` — stripe_setup_intent_onboarding
7. `20260804120000` — invoice_close_dry_run
8. `20260805120000` — final_commission_invoice_creation
9. `20260806120000` — stripe_charge_dry_run
10. `20260807120000` — stripe_off_session_charge_attempts
11. `20260808120000` — stripe_payment_webhook_accounting
12. `20260809120000` — payment_recovery_policy

**Implication:** Any future `supabase db push` / migration apply must be scoped explicitly — **never assume F4b-only**.

---

## 4. Danish partial state (read-only, 2026-07-10)

Provider: Danish Lunch Pilot · `799ba3a2-a127-48a0-87b7-87944a2f42a3` · week `2031-11-03`

| sort_order | product_name_snapshot (truncated) | unit | VAT | price ex-VAT | snapshot_mode |
|------------|-----------------------------------|------|-----|--------------|---------------|
| 1 | Påsmurt · Ost & Skinke · … (localized bundle) | porsjon | **0.25** | **10500** | `localized_generated_content` |
| 2 | Salatboks · Skinke · … (localized bundle) | porsjon | **0.25** | **10500** | `localized_generated_content` |
| 7 | **Kylling i karry** | porsjon | **0.25** | **10500** | `localized_generated_content` |

**Assessment:** Post-F4b state is **stable and improved** vs F4 evidence (was 0.15 VAT + tier product names). Varmrett row shows generated `mealTitle`. Paasmurt/Salatboks rows carry localized bundle text (not bare tier names).

| Metric | Value |
|--------|-------|
| `menu_service_days` total | 79 |
| Danish orders | 0 |
| Global orders | **17** (unchanged baseline) |
| `provider_invoices` | 0 |

---

## 5. SOT / auto-rollout (read-only)

Per [`danish-sot-cutover-f4-evidence.md`](./danish-sot-cutover-f4-evidence.md) F4 containment (2026-07-10):

| Flag | Production |
|------|------------|
| `LP_LOCALIZED_GENERATOR_SOT_ENABLED` | **Removed** |
| `LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST` | **Removed** |
| `LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED` | **Removed** |
| Auto-rollout | **OFF** |

SOT runtime: **CONTAINED OFF**. This verification did not mutate Vercel env.

---

## 6. Local gates (@ `0b441692`)

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run ci:commercial-hardcodes-guard` | **PASS** (1028/1028) |
| `npm run test:golden-path` | **PASS** (103 tests) |
| Focused F4b + sync + golden-path governance | **PASS** (47 tests, 4 files) |

---

## 7. Decision analysis (12 questions)

| # | Question | Answer |
|---|----------|--------|
| 1 | PR #479 source on main? | **YES** |
| 2 | PR #481 truth-state on main? | **YES** |
| 3 | Migration file present? | **YES** |
| 4 | Migration not yet applied in production? | **NO — ALREADY APPLIED** |
| 5 | Would production apply include only 20260810120000? | **N/A — already applied; future bulk apply would include 11 pending billing migrations** |
| 6 | Danish partial state stable? | **YES — improved post-F4b** |
| 7 | SOT flags OFF? | **YES** (per F4 containment evidence) |
| 8 | Auto-rollout OFF? | **YES** |
| 9 | Orders unchanged? | **YES** — 17 global, 0 Danish |
| 10 | Billing untouched? | **YES** — 0 provider_invoices |
| 11 | `lp_order_set` untouched? | **YES** — no migration/order-path change in this session |
| 12 | Safe to give F4b production apply GO? | **NO — migration already applied** |

### Decision

**NOT READY — BLOCKERS LISTED**

| Blocker | Detail |
|---------|--------|
| **B1** | F4b migration `20260810120000` **already in production ledger** |
| **B2** | Production apply GO is **not applicable** — work is done |
| **B3** | Truth index (`go-truth-state-reconciliation-2026-07-10.md`) states F4b pending — **docs drift** to reconcile |

### What IS ready

| Item | Status |
|------|--------|
| F4b source correctness | **VERIFIED** |
| F4b production schema/trigger | **APPLIED + VERIFIED** |
| Danish MSDI localized snapshots | **PRESENT** with `localized_generated_content` |
| Broad SOT cutover | **NO-GO** — SOT runtime OFF |
| Danish scoped re-cutover (with SOT flags) | **NEEDS OWNER DECISION** — infra ready; separate GO |

---

## 8. Next action

| Item | Action |
|------|--------|
| F4b production apply | **Do not apply** — already done |
| Truth index update | Merge this evidence; update reconciliation index F4b status |
| Next technical gate | Danish scoped SOT re-cutover verification OR billing migration ledger reconciliation |

**Exact next GO prompt:**

```text
GO Danish scoped SOT re-cutover verification — read-only production read-back first, SOT flags OFF unless explicit scoped GO, no auto-rollout
```

Alternative if billing track is priority:

```text
GO billing migration ledger reconciliation — read-only audit of 11 pending migrations vs production, no apply, no SOT start
```

**STOP.** Do not apply F4b migration. Do not start SOT. Do not auto-rollout.
