# Final Scoped SOT Cutover Readiness Check

**Status:** Evidence archived · docs-only · **readiness decision issued**
**Date:** 2026-07-10
**Main HEAD (audit):** `79d3866c` — docs(menu): archive localized generator SOT dry-run proof (#474)
**Audit type:** Read-only. No SOT start. No auto-rollout. No publish. No production mutation.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

This is the **final scoped readiness check** before a separate, explicit **scoped SOT cutover GO** for one provider/week/doc. It does **not** start SOT, does **not** change production flags or env, and does **not** authorize production mutation.

**Preferred future cutover target:** Danish Lunch Pilot · `799ba3a2-a127-48a0-87b7-87944a2f42a3` · doc `menuDay-799ba3a2-a127-48a0-87b7-87944a2f42a3-2031-11-03-BASIS-varmrett` · `2031-11-03` · `BASIS`.

---

## 2. Evidence gates on main

| Gate / phase | Status | Evidence |
|---|---|---|
| A — Phase C stability | **PASS** | Phase C chain #446–#458 · launch chain #459–#462 |
| B — Publish workflow proof | **PASS** | PR #469 |
| C — Rollback drill | **PASS** | PR #468 |
| D — SOT cutover design | **PASS** | PR #465 |
| E — Final SOT readiness audit | **Archived** | PR #470 |
| Visibility/materialization proof | **PASS** | PR #471 |
| F — Implementation plan | **PASS** | PR #472 |
| F0 — Runtime hook (default OFF) | **PASS** | PR #473 |
| F1 — Dry-run proof | **PASS** | PR #474 |
| SOT cutover execution | **NOT STARTED** | — |
| Auto-rollout | **NOT STARTED** | — |

---

## 3. Production read-only verification (2026-07-10)

| Check | Result |
|---|---|
| SOT flags in production runtime | **Not enabled** — `resolveLocalizedGeneratorSotDecision` / `isLocalizedGeneratorSotEnabled` absent from `app/` routes |
| Production env SOT activation | **None** — no env mutation in this session |
| Auto-rollout | **Not started** — resolver invariant `autoRollout: false`; no rollout coupling in generator SOT modules |
| Phase D | **Source-only** — 12 targets `SOURCE_ONLY` (governance tests PASS) |
| Danish provider (Supabase) | **Exists** — `Danish Lunch Pilot` · `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| Danish proof doc (Sanity) | **Exists** — `_rev A9KxU337ELsycETkokQcEf` · `approvedForPublish=true` · `customerVisible=true` · `providerRef` match · `mealTitle` «Kylling i karry» · `planTier=BASIS` · `date=2031-11-03` |
| Test tenant scaffolding | **Exists and paused** — company `d516bf12-2650-44e4-b4e1-25bc54a69ec9` · `paused=true` |
| Danish `menu_service_days` | **Exactly 1 row** — `2031-11-03` · `state=published` · location `48668121-…` (visibility proof artifact) |
| `menu_service_days` total | **87** |
| Danish orders | **0** |
| Global orders | **17** — unchanged baseline |
| Melhus / protected providers | **Stable** — no mutation in this session; visibility proof baseline preserved |
| Unexpected materialization | **None** — no delta in this read-only session |
| Production flags | **Unchanged** — no flag mutations performed |
| Anonymous `/api/week` · `/api/order/window` | **401 safe** — per prior gate evidence; hook not wired to employee routes |
| Economy/metadata leakage | **None introduced** — SOT hook not serving employee payloads |

---

## 4. Local gates (@ `79d3866c`)

| Command | Result |
|---|---|
| `npm run typecheck` | **PASS** |
| `npm run lint` | **PASS** |
| `npm run ci:commercial-hardcodes-guard` | **PASS** |
| `npm run test:golden-path` | **PASS** (101 tests) |
| `npm run test:run` | **PASS** (5226 tests) |
| Focused SOT + Phase D tests | **PASS** (36 tests) |

---

## 5. Decision analysis (15 questions)

| # | Question | Answer |
|---|---|---|
| 1 | Gates A–E closed on main? | **YES** |
| 2 | Visibility/materialization proof closed? | **YES** (#471) |
| 3 | F0 hook merged, default OFF? | **YES** (#473) |
| 4 | F1 dry-run closed? | **YES** (#474) |
| 5 | SOT still not started? | **YES** |
| 6 | Auto-rollout still not started? | **YES** |
| 7 | Allowlist behavior safe? | **YES** — empty/wrong ⇒ inert; dry-run proven |
| 8 | Dry-run behavior safe? | **YES** — `wouldSelectGenerated` without mutation |
| 9 | Kill-switch/fail-closed safe? | **YES** — master OFF ⇒ legacy |
| 10 | Phase D source-only? | **YES** |
| 11 | Billing/Stripe separate? | **YES** |
| 12 | Order write-path / `lp_order_set` untouched? | **YES** |
| 13 | Danish safest cutover target? | **YES** — far-future, 0 orders, proof artifacts scoped |
| 14 | msdi/NOK boundary acceptable for first cutover? | **CONDITIONAL** — see §6 |
| 15 | Ready for later scoped SOT cutover GO? | **READY ONLY IF OWNER ACCEPTS MSDI/NOK V1 BOUNDARY** |

---

## 6. msdi / commercial snapshot decision

### Current behavior

- `menu_service_day_items` snapshots **global tier products** via `syncMenuServiceDayItemsAfterMenuDayPublish` — not generated localized menuDay body.
- Visibility proof (#471) confirmed 3 msdi rows: **Paasmurt, Salatboks, Varmrett** at default **NOK-denominated** tier pricing (`TIER_PRICE_CENTS`).
- F0 resolver documents mode: `tier_products_global_catalog` · `msdiLocalizedMappingBlocked: true`.

### Risk for Danish cutover target

- Danish Lunch Pilot market is **DKK** (`da-DK`). SOT v1 would make generated Sanity menu text authoritative for menu visibility, but **commercial line snapshots would remain global NOK tier products** unless Option B is implemented.
- Employee `/week` menu text may show «Kylling i karry» while msdi commercial identity remains Norwegian tier product names/prices — acceptable only as an explicitly documented limitation.

### Classification

| Option | Assessment |
|---|---|
| **A — Accept tier-product/NOK snapshot as SOT v1** | **Viable for scoped technical cutover** if owner explicitly accepts commercial snapshot limitation for Danish pilot |
| **B — Require localized item mapping first** | **Required for commercial correctness** in non-`nb-NO` markets without documented residual risk |

### Decision

**READY ONLY IF OWNER ACCEPTS MSDI/NOK V1 BOUNDARY**

All technical gates are closed. The single remaining decision is **commercial/product-owner acceptance** of Option A for the first scoped Danish cutover.

### Required wording for any future cutover GO

> Owner accepts that for Danish Lunch Pilot scoped SOT cutover, `menu_service_day_items` will continue to snapshot global tier products at default NOK-denominated pricing (Paasmurt/Salatboks/Varmrett). Localized commercial naming/pricing per market remains deferred. Cutover GO must document this limitation explicitly.

---

## 7. Readiness decision

**READY ONLY IF OWNER ACCEPTS MSDI/NOK V1 BOUNDARY**

- **Not** unconditional `READY FOR SCOPED SOT CUTOVER GO` — Danish market (DKK) + NOK tier snapshots require explicit owner acceptance.
- **Not** `NOT READY` — no technical blockers remain; F0 hook exists, dry-run PASS, evidence chain complete.

### If owner accepts Option A

Next GO:

```text
GO scoped SOT cutover for Danish Lunch Pilot — one provider/date/tier only, explicit production mutation allowed, no auto-rollout, owner accepts MSDI/NOK v1 boundary
```

### If owner requires Option B

Next GO:

```text
GO implement localized msdi item mapping for SOT — default OFF, provider allowlist, no production mutation
```

---

## 8. Safety summary

| Guard | Status |
|---|---|
| Production mutation (this audit) | **NONE** |
| SOT / auto-rollout | **NOT STARTED** |
| Publish / apply paths | **NOT RUN** |
| Sanity / Supabase | **READ-ONLY only** |
| Billing/Stripe | **UNTOUCHED** |
| Order write-path / `lp_order_set` | **UNTOUCHED** |

**STOP.** This document does not authorize cutover. Separate explicit GO required.
