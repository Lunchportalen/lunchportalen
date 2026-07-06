# PR #430 — Post-merge production smoke evidence

**Status:** Evidence archived · docs-only · **production smoke PASS**  
**Date:** 2026-07-06  
**Related PR:** [#430](https://github.com/Lunchportalen/lunchportalen/pull/430) — `fix(menu): enforce Sanity provider mirror before generator apply`  
**Production commit:** `066e2596b3bf8356d218788d29175048074639a0`  
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**  
**Operator:** Cursor agent (post-merge deploy verification + dryRun-only smoke; no apply / mutation / SOT)

This document records **verification evidence** that PR #430 is live in production and that existing providers with valid Sanity provider mirrors still dryRun green, with mirror preflight fields exposed and no mutation.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Scope | PR #430 **post-merge deploy verification** + **production dryRun smoke** |
| Melhus nb-NO | Valid-mirror path only |
| Swedish Lunch Pilot sv-SE | Valid-mirror path only |
| Missing-mirror destructive production test | **NOT PERFORMED** |
| Production apply | **NOT RUN** |
| Production Sanity mutation | **NONE** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS migration | **NOT RUN** |

---

## 2. Production deploy

| Field | Result |
|-------|--------|
| Health | **PASS** (HTTP 200, `ok=true`) |
| Commit | `066e2596b3bf8356d218788d29175048074639a0` (includes PR #430) |
| Sanity dataset | `production` |
| `LP_MENU_PROFILE_RESOLVER` | **ON** |
| `LP_LOCALIZED_FIXED_MENU_GENERATOR` | **ON** |
| Apply-week route | Available |
| Unauth apply-week | HTTP **401** (expected) |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

---

## 3. Provider inventory

### 3.1 Melhus Catering AS

| Field | Result |
|-------|--------|
| Name | Melhus Catering AS |
| Provider ID | `11111111-1111-1111-1111-111111111111` |
| Slug | `melhus-catering` |
| Supabase provider | Exists |
| Organizations mirror | Exists (`type=provider`) |
| `provider_settings` | Exists |
| Profile resolves | `nb-NO` / `norwegian_company_lunch` / NO / NOK |
| Sanity provider mirror | Exists |
| Mirror id/slug match | **PASS** |
| providerRef resolves | **PASS** |
| Provider admin session | Works |
| Order count snapshot | **17** |

### 3.2 Swedish Lunch Pilot

| Field | Result |
|-------|--------|
| Name | Swedish Lunch Pilot |
| Provider ID | `a08e4742-c89d-48c5-a6a8-cf8532179083` |
| Slug | `swedish-lunch-pilot` |
| Supabase provider | Exists |
| Organizations mirror | Exists (`type=provider`) |
| `provider_settings` | Exists |
| Profile resolves | `sv-SE` / `swedish_lunch` / SE / SEK |
| Sanity provider mirror | Exists |
| Mirror id/slug match | **PASS** |
| providerRef resolves | **PASS** |
| Provider admin session | Works |
| Order count snapshot | **0** |

---

## 4. Melhus dryRun

| Field | Result |
|-------|--------|
| Week | `2031-10-06` (far-future) |
| Mode | `categoryScope=all_supported` · `overwriteMode=create_missing_only_strict` · `dryRun=true` |
| RID | `prov_mapply_mr94rhgz_ll75n3bf5v9gvuad` |
| HTTP | **200** |
| `ok` | `true` |
| Supported categories | **8/8** |
| Unsupported categories | `[]` |
| `providerMirrorPreflight.ok` | `true` |
| `safeToApply` | `true` |
| `applyBlocked` | `false` |
| Catalog updates | **0** |
| Mutation performed | **false** |
| Employee economy exposure | **false** |
| Employee metadata exposure | **false** |

---

## 5. Swedish dryRun

| Field | Result |
|-------|--------|
| Week | `2031-10-13` (far-future) |
| Mode | `categoryScope=all_supported` · `overwriteMode=create_missing_only_strict` · `dryRun=true` |
| RID | `prov_mapply_mr94rvh3_ssdnz3d6agm1bssg` |
| HTTP | **200** |
| `ok` | `true` |
| Supported categories | **8/8** |
| Unsupported categories | `[]` |
| `providerMirrorPreflight.ok` | `true` |
| `safeToApply` | `true` |
| `applyBlocked` | `false` |
| Catalog updates | **0** |
| Swedish labels | Mackor · Sallader · Varmrätt · Vegetariskt |
| Norwegian fallback (`Påsmurt` / `Salatboks`) | **none** |
| Mutation performed | **false** |
| Employee economy exposure | **false** |
| Employee metadata exposure | **false** |

---

## 6. Guardrail confirmation

| Item | Result |
|------|--------|
| Missing-mirror destructive production test | **NOT PERFORMED** (no production provider create/delete; no Sanity mutate) |
| Missing-mirror behavior coverage | Covered by PR #430 tests (`providerMirrorPreflight` + `applyProviderMirrorPreflight`) |
| HTTP 500 empty body risk | **MITIGATED** — apply returns structured `provider_mirror_*` and HTTP **422** |
| Partial write risk | **MITIGATED** — preflight fails before `writeGeneratedSharedVarmrettForProvider` / `applyCatalogCategories` |
| `syncProviderToSanity` auto-run in apply | **NO** — intentional; operator action only |

Operators must still run `syncProviderToSanity` and verify mirror read-only **before first apply** for any new provider.

---

## 7. Safety

| Check | Result |
|-------|--------|
| Order count Melhus | 17 → 17 |
| Order count Swedish | 0 → 0 |
| Order count global | 17 → 17 |
| Production Sanity | **READ-ONLY** (dryRun only) |
| Provider catalog `_rev` | Unchanged |
| Provider mirror `_rev` | Unchanged |
| Global templates `_rev` | Unchanged |
| Smoke-week menuDays | Unchanged |
| Order write-path | Untouched |
| `lp_order_set` | Untouched |
| DB / RLS | Unchanged |
| Production flags | Unchanged |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| Employee `/api/week` | PASS |
| Employee `/api/order/window` | PASS |
| Economy / metadata leak | **none** |

---

## 8. Known risk

1. `syncProviderToSanity` remains **manual** before first apply for **new** providers.
2. This is **intentional** — apply does **not** auto-sync to production Sanity.
3. Operators must use dryRun and confirm `safeToApply=true` before any scoped apply GO.

---

## 9. Decision

| Field | Result |
|-------|--------|
| Smoke status | **PASS** |
| Recommendation | Evidence archived. No production apply. No SOT. No auto-rollout. Await separate explicit GO for any further production action. |

**STOP.** Do not start SOT. Do not auto-rollout. Do not run production apply or production mutations without a separate scoped GO.
