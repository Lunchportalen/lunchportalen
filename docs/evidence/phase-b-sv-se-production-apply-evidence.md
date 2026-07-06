# Phase B — Swedish Lunch Pilot production apply evidence (2031-09-01)

**Status:** Evidence archived · docs-only · **production apply PASS**  
**Date:** 2026-07-06  
**Production commit:** `7de160db7b66f0e5a3467484bfd43b6186f47cbf`  
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**  
**Operator:** Cursor agent (single scoped Phase B apply session; no SOT / auto-rollout)

This document records **verification evidence** for the first **non-nb** Phase B production apply: **Swedish Lunch Pilot** week `2031-09-01`. One provider · one far-future week · strict mode only.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase B** — first non-nb production apply |
| Provider | **Swedish Lunch Pilot only** (single session) |
| Market | **sv-SE only** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS migration | **NOT RUN** |

---

## 2. Provider

| Field | Value |
|-------|-------|
| Name | Swedish Lunch Pilot |
| Provider ID | `a08e4742-c89d-48c5-a6a8-cf8532179083` |
| Slug | `swedish-lunch-pilot` |
| menuLocale | `sv-SE` |
| menuProfileId | `swedish_lunch` |
| Country | SE |
| Currency | SEK |
| Timezone | `Europe/Stockholm` |

---

## 3. Week

| Field | Value |
|-------|-------|
| Week start | `2031-09-01` (Monday) |
| Weekdays | `2031-09-01` → `2031-09-05` (5 days) |
| Type | **Far-future** (no live orders) |
| Pre-apply menuDays | **0** (clean week) |

**Apply mode:** `categoryScope=all_supported` · `overwriteMode=create_missing_only_strict` · `packageTier=LUXUS`

---

## 4. Pre-apply

| Check | Result |
|-------|--------|
| Production commit | `7de160db` |
| Dataset | **`production`** |
| Order count (global) | **17** |
| Order count (provider-scoped) | **0** |
| Provider catalog snapshot | **No provider-scoped catalog** before apply |
| Existing menuDays (target week) | **0** |

### Pre-apply dryRun

Executed immediately before apply (`dryRun=true`).

| Check | Result |
|-------|--------|
| RID | `prov_mapply_mr8g5idr_viz6wlleepe5lozq` |
| HTTP / ok | **200 / true** |
| supportedCategories | **8/8** |
| unsupportedCategories | **`[]`** |
| wouldCreate | **`[vegetarian]`** |
| wouldUpdate | **`[]`** |
| Catalog updates | **0** |
| Plan summary | `createdDraftDays=5` · `totalGeneratedItems=30` |
| Sanity mutation | **NONE** |

---

## 5. Provider mirror prerequisite

First apply attempt returned **HTTP 500** with **empty body**.

| Item | Detail |
|------|--------|
| Root cause | Missing Sanity **provider-mirror** document for Swedish Lunch Pilot |
| Symptom | `menuDay` / `lunchCategory` writes reference `provider._ref`; Sanity rejects when provider doc absent |
| Fix (before successful apply) | Synced provider mirror from Supabase → Sanity |
| Sanity provider `_id` | `a08e4742-c89d-48c5-a6a8-cf8532179083` |
| Slug | `swedish-lunch-pilot` |
| Nature | **Provider metadata prerequisite** — not menu content |

**Future onboarding checklist addition:** run `syncProviderToSanity` (or equivalent mirror upsert) **before first production apply** for any new provider.

---

## 6. Apply result

| Field | Value |
|-------|--------|
| HTTP / ok | **200 / true** |
| RID | `prov_mapply_mr8g5iyz_5qaxbt6yyyjwxcge` |
| Mode | `create_missing_only_strict` · `categoryScope=all_supported` · **no publish** |
| Applied dates | `2031-09-01` · `2031-09-02` · `2031-09-03` · `2031-09-04` · `2031-09-05` |
| Created menuDay drafts | **15** (5 weekdays × BASIS · LUXUS · ENTERPRISE) |
| Created provider catalog docs | **`vegetarian`** — `lunchCategory-a08e4742-c89d-48c5-a6a8-cf8532179083-vegetarian` |
| Updated catalog docs | **0** |
| Published docs changed | **0** |
| Extra docs created | **0** |

---

## 7. Read-back

| Check | Result |
|-------|--------|
| menuDay docs (target week) | **15** |
| Unique weekdays | **5/5** |
| Tier matrix | BASIS + LUXUS + ENTERPRISE per weekday — **PASS** |
| approvedForPublish | **false** (all 15 docs) |
| customerVisible | **false** (all 15 docs) |
| providerRef | Swedish Lunch Pilot (`a08e4742-c89d-48c5-a6a8-cf8532179083`) |
| Allergens | **Present** on all menuDay docs |
| Swedish content | **Confirmed** — e.g. Kycklinggryta med ris · Ugnsbakad lax med dillpotatis |
| Category labels (menu surface) | Mackor · Sallader · Varmrätt · Vegetariskt |
| Norwegian fallback in `package-card-basis-includes` | **None** |
| Global template `_rev` values | **Unchanged** |
| Melhus docs | **Untouched** |

**Known UI caveat:** Full page chrome still contains **Påsmurt** / **Salatboks** labels outside the provider menu surface (documented; not in basis-includes).

---

## 8. Post-apply dryRun (idempotency)

| Check | Result |
|-------|--------|
| RID | `prov_mapply_mr8g60dg_zo2aivkkdi7o02j8` |
| HTTP / ok | **200 / true** |
| createdDraftDays | **0** |
| updatedDraftDays | **0** |
| Catalog updates | **0** |
| unsupportedCategories | **`[]`** |
| vegetarian status | `would_skip_existing_category` |
| Duplicates | **None** |
| Sanity mutation on dryRun | **NONE** |

---

## 9. Safety regression

| Check | Result |
|-------|--------|
| Order count (global) | **17 → 17** (unchanged) |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| Employee `/api/week` | **PASS** |
| Employee `/api/order/window` | **PASS** |
| Employee economy exposure | **NONE** |
| Employee metadata exposure | **NONE** |
| DB / RLS | **UNCHANGED** |
| Production flags | **UNCHANGED** (`LP_MENU_PROFILE_RESOLVER=ON`, `LP_LOCALIZED_FIXED_MENU_GENERATOR=ON`) |
| Production Sanity changes | Provider mirror · **1** vegetarian catalog doc · **15** menuDay drafts only |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Rollback needed | **NO** |
| Rollback performed | **NO** |

---

## 10. Known risks

1. **First non-nb production apply** — Swedish Lunch Pilot is the first non-nb provider with Phase B production apply.
2. **Provider mirror required** — Sanity `provider` document must exist before apply; onboarding must include mirror sync.
3. **Page chrome nb labels** — Påsmurt / Salatboks may appear outside provider menu surface until broader UI localization.
4. **Far-future drafts only** — Week `2031-09-01` docs are unpublished; no employee-visible menu change until publish workflow.
5. **No further production applies** — Each additional provider/week requires separate scoped operator **GO**.
6. **SOT** — **NO-GO** (unchanged).
7. **Auto-rollout** — **NO-GO** (unchanged).

---

## 11. Rollback boundary (not executed)

Rollback was **not needed**. If required, allowed scope:

- Delete **only** menuDay draft docs for Swedish Lunch Pilot week `2031-09-01` → `2031-09-05` where `approvedForPublish=false` and `customerVisible=false`
- Delete provider-scoped **vegetarian** catalog doc **only if** created in this apply session and still draft/unpublished

**Forbidden:** global templates · Melhus docs · existing provider catalog docs not created in session · published docs · orders

---

## 12. Decision

| Item | Verdict |
|------|---------|
| **Phase B sv-SE apply (2031-09-01)** | **PASS** |
| **SOT readiness** | **NO-GO** (unchanged) |
| **Auto-rollout** | **NO-GO** (unchanged) |
| **Next step** | Await explicit scoped **GO** for any further production apply |

**Do not** run additional production applies, start SOT, or start auto-rollout without separate operator GO.

---

## 13. Related documents

| Document | Role |
|----------|------|
| [`phase-b-provider-2-sv-se-onboarding-evidence.md`](./phase-b-provider-2-sv-se-onboarding-evidence.md) | Provider #2 onboarding + dryRun-only |
| [`phase-b-melhus-2031-08-04-apply-evidence.md`](./phase-b-melhus-2031-08-04-apply-evidence.md) | Prior Phase B Melhus apply |
| [`../runbooks/localized-generator-sot-rollout-readiness.md`](../runbooks/localized-generator-sot-rollout-readiness.md) | Rollout runbook |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
