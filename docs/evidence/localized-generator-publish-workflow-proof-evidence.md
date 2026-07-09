# Localized Generator Publish Workflow Proof Evidence

**Status:** Evidence archived · docs-only · **publish workflow proof PASS (Gate B — approval stage)**
**Date:** 2026-07-09
**Main HEAD (archive):** `6a6e8573` — docs(menu): archive localized generator rollback drill evidence (#468)
**Environment:** Production Sanity — project `4udoq5d8` · dataset `production`
**Design authority:** [`docs/engineering/localized-generator-sot-cutover-design.md`](../engineering/localized-generator-sot-cutover-design.md) §9 (publish workflow proof plan, Gate B)

This document records the **scoped publish workflow proof** required by SOT Gate B. Exactly one scoped mutation was performed: `approvedForPublish: false → true` on one generated localized draft menuDay document. `customerVisible` remained `false` throughout — nothing became employee-visible and no Supabase materialization occurred.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Gate | **B — publish workflow proof** (approval stage, scoped) |
| Mutation | One field (`approvedForPublish=true`) on one exact doc ID — nothing else |
| Broad publish | **NOT RUN** |
| `customerVisible` | **Unchanged (`false`)** — no employee visibility |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Generator apply / onboarding apply / Phase D apply | **NOT RUN** |
| Supabase mutation | **NONE** (read-only counts only; materialization proven not triggered) |
| Billing/Stripe | **NOT TOUCHED** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| Production flags | **UNCHANGED** |
| Rollback / deletes | **NOT RUN** in this session |

## 2. Target

| Field | Value |
|-------|-------|
| Provider | Danish Lunch Pilot |
| ProviderId | `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| Slug | `danish-lunch-pilot` |
| Locale / profile | `da-DK` / `danish_office_lunch` |
| Doc ID | `menuDay-799ba3a2-a127-48a0-87b7-87944a2f42a3-2031-11-03-BASIS-varmrett` |
| Doc type | `menuDay` (generated operational draft, deterministic ID) |
| mealTitle | Kylling i karry |
| Date / tier | `2031-11-03` (far-future) / `BASIS` |
| Created | `2026-07-06T22:03:58Z` by evidenced da-DK generator apply (RID `prov_mapply_mr9rouz8_k89tur64mgwzktnx`) |
| Pre-proof `_rev` | `aD45H1NEbb1bqELwluiMSt` |
| Source evidence | [`phase-c-da-dk-generator-apply-evidence.md`](./phase-c-da-dk-generator-apply-evidence.md) |

## 3. Why this target was safe

1. Far-future week `2031-11-03` — no live orders (global 17, Danish 0, Melhus 17).
2. Doc verified pre-proof: `approvedForPublish=false` · `customerVisible=false` · providerRef match · no `drafts.*` variant.
3. Not part of the Italian rollback-deleted set (different provider).
4. Not a global template, not Phase D, not Melhus/customer-near.
5. Materialization boundary verified in code before mutation: the Sanity→Supabase webhook (`app/api/webhooks/sanity/menu-day/route.ts`) syncs `menu_service_days` only when `menuDayIsPublishVisible` — which requires **both** `customerVisible == true` **and** `approvedForPublish == true`. Setting only `approvedForPublish` therefore provably cannot materialize or expose the doc.
6. Zero `menu_service_days` rows existed for the target week/provider before and after (verified read-only).

## 4. Why `approvedForPublish`-only is the correct Gate B proof

The publish workflow contract has two stages: **approval** (`approvedForPublish`) and **visibility** (`customerVisible`), with materialization/employee exposure gated on the conjunction. This GO forbids Supabase mutation, and setting `customerVisible=true` would trigger webhook materialization writes into `menu_service_days`. The scoped proof therefore exercises the approval transition end-to-end on a generated doc and simultaneously proves the safety boundary: an approved-but-not-visible generated doc stays invisible to employees and creates no downstream writes. The remaining visibility stage (customerVisible → materialization → `/week`) is the documented residual scope for Gate E/F consideration (see §11).

## 5. Pre-publish snapshot (read-only)

| Item | Value |
|------|-------|
| Target doc flags | `approvedForPublish=false` · `customerVisible=false` |
| All 15 Danish target-week docs | All `false`/`false` |
| Danish approved-or-visible docs | 0 |
| Danish menuDays | 15 · Melhus 226 · Swedish/Finnish/UK/German/French/Spanish 15 each · Italian 0 · total 331 |
| Danish catalog doc `_rev` | `aD45H1NEbb1bqELwluiPVR` |
| Danish provider mirror `_rev` | `ops2aYkxIM6NMo1gE0yE9u` |
| Global templates | 7 docs, `_rev` set snapshotted |
| Orders (global / Danish / Melhus) | 17 / 0 / 17 |
| `menu_service_days` (target week / Danish total) | 0 / 0 |
| Providers total | 9 |
| Anonymous `/api/week` · `/api/order/window` | 401 safe |
| Production flags | Untouched |

## 6. Mutation performed

| Field | Value |
|-------|-------|
| Method | Single Sanity patch on exact ID with optimistic lock (`ifRevisionID` = pre-proof `_rev`) |
| Fields changed | `approvedForPublish: false → true` (only) |
| Result `_rev` | `1zexheHxKDYI99qGZrA2vw` |
| Executed | Exactly once — no retry |
| Errors | None |
| Abort gates | Rev mismatch / providerRef mismatch / non-false flags / existing draft variant — all validated in code before commit; none hit |

## 7. Post-publish read-back

| Check | Result |
|-------|--------|
| Target doc | `approvedForPublish=true` · `customerVisible=false` — exactly as planned |
| Publish-visible predicate (`both true`) | **`false`** — doc remains non-visible |
| Other 14 Danish week docs | **Unchanged** (all `false`/`false`) |
| Extra docs changed | **0** |
| `drafts.*` variant created | **None** |
| Danish menuDays | 15 — unchanged · Melhus 226 · total 331 |
| Danish catalog doc `_rev` | **Unchanged** |
| Danish provider mirror `_rev` | **Unchanged** |
| Global templates | **7 docs, `_rev` byte-identical** |
| `menu_service_days` (target week / Danish total) | **0 / 0 — no materialization** |
| Orders (global / Danish / Melhus) | **17 / 0 / 17 — unchanged** |
| Anomalies | **None** |

## 8. Employee/API safety

| Check | Result |
|-------|--------|
| Anonymous `/api/week` | **401 safe** (before and after) |
| Anonymous `/api/order/window` | **401 safe** (before and after) |
| Employee exposure of target doc | **Impossible by contract** — `/week` reads materialized `menu_service_days` only; 0 rows exist for the week |
| Economy/metadata leakage | None — no new surface created |
| Phase D leakage | None (Phase D footprint remains 0) |
| Authenticated employee spot-check | Relies on archived authenticated PASS (final Phase C audit §9) — visibility surface unchanged by this proof |

## 9. Release safety

- SOT: **NOT STARTED** · Auto-rollout: **NOT STARTED** · Broad publish: **NOT RUN**
- Generator apply / onboarding apply / Phase D apply: **NOT RUN**
- Supabase: read-only queries only — **no mutation, no materialization triggered**
- Order write-path / `lp_order_set`: **untouched**
- Billing/Stripe: **untouched**
- Production flags: **unchanged**
- Deletes/rollback: **not run** in this session
- Secrets/tokens/env values: **not printed, not committed**

## 10. Rollback boundary (if needed later — separate GO)

Single-field revert on the exact ID: set `approvedForPublish=false` on `menuDay-799ba3a2-a127-48a0-87b7-87944a2f42a3-2031-11-03-BASIS-varmrett` (optimistic lock on `_rev 1zexheHxKDYI99qGZrA2vw`). No deletes required. No other doc affected. Not executed in this GO.

## 11. Known risks / residual scope

1. Production inventory expectations of "generated approved: 0" now read **1** (this doc) — intentional, documented proof artifact.
2. The **visibility stage** (customerVisible=true → webhook materialization → employee `/week`) is intentionally **not** exercised here because it writes to Supabase `menu_service_days`, which this GO forbids. If Gate E requires full end-to-end visibility proof, it needs its own scoped GO explicitly permitting that materialization write.
3. The doc remains far-future and non-visible; no customer impact.

## 12. Next action

| Item | Action |
|------|--------|
| This document | Archive evidence (docs-only PR) |
| Gate E — final SOT readiness audit | **Separate read-only GO required** |
| SOT | **Do not start** |
| Auto-rollout | **Do not start** |

**Exact next GO prompt (separate GO only):**

```text
GO final SOT readiness audit — read-only, no SOT start, no auto-rollout
```
