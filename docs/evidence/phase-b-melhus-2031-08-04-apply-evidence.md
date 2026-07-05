# Phase B — Melhus production apply evidence (2031-08-04)

**Status:** Evidence archived · docs-only · **production apply PASS**  
**Date:** 2026-07-06  
**Production commit:** `3aa440ee537a7c23b6e5f2c3c72e3e29a246163d`  
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**  
**Operator:** Cursor agent (single scoped Phase B apply session; no SOT / auto-rollout)

This document records **verification evidence** for Phase B scoped production apply on Melhus week `2031-08-04`. One provider · one week · strict mode only.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase B** — scoped provider apply |
| Providers | **Melhus only** (single session) |
| Batch apply | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Publish-as-apply | **NOT RUN** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** |

---

## 2. Provider

| Field | Value |
|-------|-------|
| Name | Melhus Catering AS |
| Provider ID | `11111111-1111-1111-1111-111111111111` |
| Slug | `melhus-catering` |
| menuLocale | `nb-NO` |
| menuProfileId | `norwegian_company_lunch` |
| Country | NO |
| Currency | NOK |

---

## 3. Week

| Field | Value |
|-------|-------|
| Week start | `2031-08-04` (Monday) |
| Weekdays | `2031-08-04` → `2031-08-08` (5 days) |
| Type | **Far-future** (no live orders) |
| Pre-apply menuDays | **0** (clean week) |
| Other Melhus far-future weeks (separate) | `2031-03-31` canary · `2031-07-07` prior Phase B apply (untouched) |

**Apply mode:** `categoryScope=all_supported` · `overwriteMode=create_missing_only_strict` · `packageTier=LUXUS`

---

## 4. Pre-apply dryRun

Executed immediately before apply (`dryRun=true`).

| Check | Result |
|-------|--------|
| HTTP / ok | **200 / true** |
| supportedCategories | **8/8** |
| unsupportedCategories | **`[]`** |
| wouldCreate | **`[]`** |
| wouldUpdate | **`[]`** |
| wouldSkip | sandwich · salad · sushi · poke · asian · vegetarian |
| Catalog updates | **0** |
| Published blockers | **`[]`** |
| vegetarian status | `would_skip_existing_category` |
| Plan summary | `createdDraftDays=5` · `createdCategories=5` · `updatedDraftDays=0` |
| Sanity mutation | **NONE** |

**Pre-apply catalog snapshot:**

| Doc | Key | `_rev` (unchanged through apply) |
|-----|-----|----------------------------------|
| Provider paasmurt | `paasmurt` | `WMYow9Ig064KslncDIr3Bi` |
| Provider vegetarian | `vegetarian` | `LQk5eaqcrnD6ierE4vnimP` |

**Order count before:** **17**

---

## 5. Apply result

| Field | Value |
|-------|-------|
| HTTP / ok | **200 / true** |
| RID | `prov_mapply_mr8dwg0o_gbeurmdrsy99cho0` |
| Applied dates | `2031-08-04` · `2031-08-05` · `2031-08-06` · `2031-08-07` · `2031-08-08` |
| Applied catalog categories | **`[]`** |
| Created menuDay drafts | **15** |
| Structure | 5 weekdays × 3 tiers (BASIS · LUXUS · ENTERPRISE) |
| Category | `varmrett` (hot meal tier-docs) |
| Updated catalog docs | **0** |
| Published docs changed | **0** |
| Extra dates | **None** |

**Sample nb-NO meal titles (read-back):**

- `2031-08-04` — Laks med agurksalat og poteter
- `2031-08-05` — Biff med peppersaus

---

## 6. Read-back

| Check | Result |
|-------|--------|
| menuDay docs (target week) | **15** |
| Unique weekdays | **5/5** |
| Tier matrix | BASIS + LUXUS + ENTERPRISE per weekday — **PASS** |
| approvedForPublish | **false** (all 15 docs) |
| customerVisible | **false** (all 15 docs) |
| providerRef | Melhus (`11111111-1111-1111-1111-111111111111`) |
| Allergens | **Present** on menuDay docs |
| nb-NO content | **Confirmed** (Norwegian meal titles) |
| Påsmurt catalog `_rev` | **Unchanged** (`WMYow9Ig064KslncDIr3Bi`) |
| Vegetarian catalog `_rev` | **Unchanged** (`LQk5eaqcrnD6ierE4vnimP`) |
| Global template `_rev` values | **Unchanged** |
| Provider UI (`/leverandor/meny?weekStart=2031-08-04`) | **PASS** — basis: Påsmurt · Salatboks · Varmrett; Vegetar visible |
| Påsmurt-katalog | **Not replaced** |

---

## 7. Post-apply dryRun (idempotency)

| Check | Result |
|-------|--------|
| HTTP / ok | **200 / true** |
| createdDraftDays | **0** |
| updatedDraftDays | **0** |
| Catalog updates | **0** |
| unsupportedCategories | **`[]`** |
| wouldCreate (catalog) | **`[]`** |
| wouldUpdate | **`[]`** |
| wouldSkip | sandwich · salad · sushi · poke · asian · vegetarian |
| vegetarian status | `would_skip_existing_category` |
| Duplicates | **None** |
| Sanity mutation on dryRun | **NONE** |

---

## 8. Safety regression

| Check | Result |
|-------|--------|
| Order count | **17 → 17** (unchanged) |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| Employee `/api/week` | **PASS** |
| Employee `/api/order/window` | **PASS** |
| Employee economy exposure | **NONE** |
| Employee metadata exposure | **NONE** |
| DB / RLS | **UNCHANGED** |
| Production flags | **UNCHANGED** (`LP_MENU_PROFILE_RESOLVER=ON`, `LP_LOCALIZED_FIXED_MENU_GENERATOR=ON`) |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Rollback | **NOT NEEDED** |

---

## 9. Known caveats

1. **Far-future drafts only** — Week `2031-08-04` docs are unpublished; no employee-visible menu change until publish workflow.
2. **Employee `/api/week`** — Reflects **published** Sanity menu until localized drafts are published.
3. **Same provider as prior sessions** — Melhus also has canary week `2031-03-31` and Phase B week `2031-07-07`; this apply targeted a separate clean week.
4. **Varmrett tier model** — Apply created **15** Sanity `menuDay` documents (5 days × 3 tiers), not 5 single docs.
5. **No further production applies** — Each additional provider/week requires separate scoped operator **GO**.

---

## 10. Rollback boundary (not executed)

Rollback was **not needed**. If required, allowed scope:

- Delete **only** menuDay draft docs for Melhus week `2031-08-04` → `2031-08-08` where `approvedForPublish=false` and `customerVisible=false`

**Forbidden:** global templates · existing provider catalog docs · published docs · orders

---

## 11. Decision

| Item | Verdict |
|------|---------|
| **Phase B Melhus apply (2031-08-04)** | **PASS** |
| **SOT readiness** | **NO-GO** (unchanged) |
| **Auto-rollout** | **NO-GO** (unchanged) |
| **Next step** | Await explicit scoped **GO** for any further production apply |

**Do not** run additional production applies, start SOT, or start auto-rollout without separate operator GO.

---

## 12. Related documents

| Document | Role |
|----------|------|
| [`phase-b-melhus-production-apply-evidence.md`](./phase-b-melhus-production-apply-evidence.md) | Prior Phase B apply (week `2031-07-07`) |
| [`localized-generator-production-evidence.md`](./localized-generator-production-evidence.md) | Melhus canary + PR #420 dryRun |
| [`localized-generator-9-locale-staging-matrix-evidence.md`](./localized-generator-9-locale-staging-matrix-evidence.md) | 9-locale staging matrix |
| [`localized-generator-launch-readiness-review.md`](./localized-generator-launch-readiness-review.md) | Launch readiness GO/NO-GO |
| [`../runbooks/localized-generator-sot-rollout-readiness.md`](../runbooks/localized-generator-sot-rollout-readiness.md) | Rollout runbook |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
