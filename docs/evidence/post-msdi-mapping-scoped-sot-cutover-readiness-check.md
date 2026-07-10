# Post-MSDI Mapping Scoped SOT Cutover Readiness Check

**Status:** Evidence archived · docs-only · **readiness decision issued**
**Date:** 2026-07-10
**Main HEAD (audit):** `0b970b43` — feat(menu): localized SOT msdi item mapping default off (#476)
**Prior check:** [`final-scoped-sot-cutover-readiness-check.md`](./final-scoped-sot-cutover-readiness-check.md) (#475) — blocked on MSDI/NOK Option A owner acceptance
**Audit type:** Read-only. No SOT start. No auto-rollout. No publish. No production mutation.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

Re-run of the **scoped SOT cutover readiness check** after PR **#476** merged localized MSDI item mapping (Option B) behind default-OFF flags. This does **not** start SOT, does **not** change production flags or env, and does **not** authorize production mutation.

**Preferred cutover target (unchanged):** Danish Lunch Pilot · `799ba3a2-a127-48a0-87b7-87944a2f42a3` · doc `menuDay-799ba3a2-a127-48a0-87b7-87944a2f42a3-2031-11-03-BASIS-varmrett` · `2031-11-03` · `BASIS`.

---

## 2. Evidence gates on main (updated)

| Gate / phase | Status | Evidence |
|---|---|---|
| A–E + visibility proof + F plan + F0 + F1 | **PASS** | #458–#474 (unchanged) |
| **F1b — Localized MSDI item mapping (default OFF)** | **PASS** | PR **#476** @ `0b970b43` |
| Final scoped readiness (#475) | **Superseded** | MSDI/NOK blocker resolved in code |
| SOT cutover execution | **NOT STARTED** | — |
| Auto-rollout | **NOT STARTED** | — |

---

## 3. What #476 changed (code truth @ `0b970b43`)

| Item | State |
|---|---|
| New flag | `LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED` — **default OFF** |
| Policy | `resolveMsdiLocalizedMappingPolicy` — active for sync only when SOT master + allowlist + MSDI flag ON and dry-run OFF |
| Pure mapper | `mapMsdiLocalizedItemSnapshot` — generated `mealTitle`/description/allergens + per-market economy pricing |
| Sync bridge | `msdiLocalizedItemSnapshot.ts` → minimal branch in `syncMenuServiceDayItems.ts` when policy active |
| Resolver phase | **F1** — `msdiLocalizedMappingBlocked: false` when MSDI flag ON; `dryRunMsdiMappingPreview` for observe-only |
| Legacy path | **Unchanged** when all flags OFF — `TIER_PRICE_CENTS` + tier-product snapshots |
| Danish/DKK path (flags ON) | **No NOK leakage** — DKK basis **10500** øre ex-VAT · VAT **0.25** (economy config); not legacy **9000** / **0.15** |
| Order write-path · `lp_order_set` | **Untouched** |
| Billing/Stripe | **Untouched** |
| `app/` SOT wiring | **Still absent** — no `resolveLocalizedGeneratorSotDecision` in routes |

---

## 4. Production read-only verification (2026-07-10)

| Check | Result |
|---|---|
| SOT flags in production runtime | **Not enabled** — SOT modules absent from `app/` |
| Production env mutation (this audit) | **NONE** |
| Auto-rollout | **Not started** — resolver invariant `autoRollout: false` |
| Phase D | **Source-only** (governance tests PASS) |
| Danish provider (Supabase) | **Exists** — `Danish Lunch Pilot` · `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| Provider market | **DK** · **DKK** · `da-DK` |
| Danish proof doc (Sanity) | **Exists** — `_rev A9KxU337ELsycETkokQcEf` · `approvedForPublish=true` · `customerVisible=true` · `mealTitle` «Kylling i karry» · `2031-11-03` · `BASIS` |
| Test tenant | **Paused** — company `d516bf12-…` · `paused=true` |
| Danish `menu_service_days` | **1 row** — `2031-11-03` · published (visibility proof artifact) |
| `menu_service_days` total | **87** |
| Global orders | **17** — unchanged baseline |
| **Current production msdi** (`2031-11-03`) | **Legacy tier-product** — 3 rows @ **9000** ex-VAT · **0.15** VAT · names Paasmurt/Salatboks/Varmrett — **expected** (flags OFF at visibility proof time) |
| Unexpected mutation (this session) | **NONE** |

**Interpretation:** Production msdi rows reflect pre-#476 legacy materialization. Localized DKK mapping applies **only after** cutover enables the SOT flag stack and triggers re-materialization — not automatically on merge.

---

## 5. Local gates (@ `0b970b43`)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run ci:commercial-hardcodes-guard` | **PASS** |
| `npm run test:golden-path` | **PASS** (102 tests) |
| `npm run test:run` | **PASS** (5242 tests) |
| Focused MSDI/SOT/sync tests | **PASS** (43 tests) |

### Simulated dry-run (local, in-memory env — not production)

| Case | `msdiSnapshotMode` | `msdiLocalizedMappingBlocked` | `wouldUseMsdiLocalizedMapping` | `hasMutationIntent` |
|---|---|---|---|---|
| Default OFF | `tier_products_global_catalog` | `true` | `false` | `false` |
| SOT + allowlist + MSDI + dry-run | `localized_generated_content` | `false` | `true` | `false` |
| SOT + allowlist + MSDI (no dry-run) | `localized_generated_content` | `false` | `true` | `false` |

Dry-run preview (Danish, DKK): sample varmrett maps «Kylling i karry» with **non-9000** price and **DKK** currency — per unit tests in `localizedGeneratorSotResolver.test.ts` and `sotMsdiItemMapping.test.ts`.

---

## 6. Decision analysis (15 questions)

| # | Question | Answer |
|---|---|---|
| 1 | Gates A–F1 closed on main? | **YES** |
| 2 | Localized MSDI mapping merged (#476)? | **YES** — default OFF |
| 3 | MSDI/NOK Option B implemented? | **YES** — behind flag stack |
| 4 | SOT still not started? | **YES** |
| 5 | Auto-rollout still not started? | **YES** |
| 6 | Allowlist / kill-switch safe? | **YES** |
| 7 | Dry-run safe (no mutation intent)? | **YES** |
| 8 | Phase D source-only? | **YES** |
| 9 | Billing/Stripe separate? | **YES** |
| 10 | Order write-path / `lp_order_set` untouched? | **YES** |
| 11 | Danish safest cutover target? | **YES** |
| 12 | Production msdi still legacy NOK? | **YES** — expected until cutover re-materialization |
| 13 | Owner must accept NOK msdi leakage for cutover? | **NO** — Option B removes that requirement |
| 14 | `/week` authoritative serve wired? | **NO** — still fail-closed to legacy; cutover GO must scope wiring |
| 15 | Ready for scoped SOT cutover GO? | **YES** — with explicit flag stack + re-materialization prerequisites |

---

## 7. msdi / commercial snapshot decision (updated)

### Prior decision (#475)

**READY ONLY IF OWNER ACCEPTS MSDI/NOK V1 BOUNDARY** — Option A only.

### Post-#476 decision

**Option B is implemented and default-OFF.** The commercial snapshot blocker is **resolved in code**. Owner acceptance of NOK tier-product leakage is **no longer required** for Danish scoped cutover.

### Cutover prerequisites (mandatory in future GO)

1. **Flag stack** (production env, scoped): `LP_LOCALIZED_GENERATOR_SOT_ENABLED=true` · `LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST=799ba3a2-…` · `LP_LOCALIZED_GENERATOR_SOT_MSDI_LOCALIZED_MAPPING_ENABLED=true` · `LP_LOCALIZED_GENERATOR_SOT_DRY_RUN=false`
2. **Re-materialization** for `2031-11-03` / `BASIS` to replace legacy 9000/0.15 msdi rows with DKK localized snapshots
3. **Read-back gate:** msdi rows must show DKK pricing (basis **10500** ex-VAT, VAT **0.25**) and generated varmrett text — not legacy 9000/NOK tier names
4. **Scope document:** whether cutover includes `/week` authoritative serve wiring or materialization-only tranche (hook still not in `app/` today)

---

## 8. Readiness decision

### **READY FOR SCOPED SOT CUTOVER GO**

All technical gates through **F1b (localized MSDI mapping)** are closed. The prior MSDI/NOK commercial blocker is **resolved**. SOT cutover execution remains **NOT STARTED** until a separate explicit operator GO authorizes production mutation and flag activation.

### Not authorized by this document

- Production env changes
- SOT / auto-rollout start
- Publish, generator apply, onboarding apply, Phase D apply
- Any Supabase or Sanity mutation

### Required wording for future cutover GO

> Scoped SOT cutover for Danish Lunch Pilot only (`799ba3a2-…`, `2031-11-03`, `BASIS`). Enable SOT + allowlist + MSDI localized mapping flags. Re-materialize msdi with DKK localized snapshots. No auto-rollout. Explicit production mutation allowed. Read-back must confirm non-9000 DKK msdi pricing.

### Next GO prompt

```text
GO scoped SOT cutover for Danish Lunch Pilot — one provider/date/tier only, explicit production mutation allowed, no auto-rollout, MSDI localized mapping flag stack ON
```

---

## 9. Safety summary

| Guard | Status |
|---|---|
| Production mutation (this audit) | **NONE** |
| SOT / auto-rollout | **NOT STARTED** |
| Publish / apply paths | **NOT RUN** |
| Sanity / Supabase (this audit) | **READ-ONLY only** |
| Billing/Stripe | **UNTOUCHED** |
| Order write-path / `lp_order_set` | **UNTOUCHED** |

**STOP.** This document does not authorize cutover. Separate explicit GO required.
