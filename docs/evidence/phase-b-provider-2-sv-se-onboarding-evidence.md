# Phase B — Provider #2 sv-SE onboarding evidence

**Status:** Evidence archived · docs-only · **onboarding + dryRun PASS**  
**Date:** 2026-07-06  
**Production commit:** `13ff732af9b66a6736ec9df787933514e4177abe`  
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**  
**Operator:** Cursor agent (provider #2 onboarding + dryRun-only; no apply · no SOT · no auto-rollout)

This document records **verification evidence** for the first non-nb production provider onboarded under Phase B: **Swedish Lunch Pilot** (`sv-SE`). Onboarding and production dryRun-only only — no apply session.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase B** — provider #2 onboarding |
| Market | **sv-SE only** (first non-nb production provider) |
| Session type | Onboarding + **dryRun-only** |
| Production apply | **NOT RUN** |
| Batch apply | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Publish-as-apply | **NOT RUN** |
| Sanity mutation | **NONE** |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS migration | **NOT RUN** |

---

## 2. Preflight

| Check | Result |
|-------|--------|
| Production health | **PASS** |
| Production commit | `13ff732a` |
| Dataset | **`production`** |
| Supabase | Production (`hkpokyapzarefrgqzkos`) |
| `LP_MENU_PROFILE_RESOLVER` | **ON** |
| `LP_LOCALIZED_FIXED_MENU_GENERATOR` | **ON** |
| sv-SE mapping | `sv-SE` → `swedish_lunch` · SE · SEK |
| Sanity global templates | **PASS** — paasmurt · salatboks · sushi · pokebowl · thaimat · vegetarian · varmrett |
| Existing sv-SE provider (before) | **0** |
| Slug / name / auth conflict | **None** |

---

## 3. Created production rows

| Field | Value |
|-------|-------|
| Provider name | Swedish Lunch Pilot |
| Provider ID | `a08e4742-c89d-48c5-a6a8-cf8532179083` |
| Slug | `swedish-lunch-pilot` |
| Status | ACTIVE |
| Creation path | `lp_provider_create` (superadmin RPC) |

**Organization mirror:**

| Field | Value |
|-------|-------|
| Exists | **Yes** |
| ID | Same as provider (`a08e4742-…`) |
| Type | `provider` |

**Provider settings:**

| Field | Value |
|-------|-------|
| locale | `sv-SE` |
| menuProfileId | `swedish_lunch` |
| default_country_code | SE |
| default_currency | SEK |
| timezone | `Europe/Stockholm` |
| cutoff_time | `08:00` |
| delivery_days | mon–fri |

**Auth:**

| Field | Value |
|-------|-------|
| Provider admin | Provisioned (unique operator email; not recorded here) |
| Membership | `provider_admin` |
| Supabase login | **PASS** |
| Tripletex outbox | Enqueued as expected (`tripletex.provider_customer_create_lp:<provider_id>`) |

**Melhus (provider #1):** Untouched.

---

## 4. Verification

| Check | Result |
|-------|--------|
| Login | **PASS** |
| Provider UI (`/leverandor/meny`) | **PASS** |
| Generator preview | **PASS** |
| menuLocale | `sv-SE` |
| menuProfileId | `swedish_lunch` |
| Country / currency | SE / SEK |
| Category labels (provider surface) | Mackor · Sallader · Varmrätt · Vegetariskt |
| Norwegian fallback (basis / preview / employeeSafe) | **None** |
| Employee economy exposure | **None** |
| Employee metadata exposure | **None** |

**Caveat:** Full-page HTML scan can show nb labels (Påsmurt / Salatboks) in **global chrome** outside the provider menu surface. Authoritative checks (basis includes, week-preview, employeeSafe) confirmed **sv-SE labels only**.

---

## 5. DryRun-only

| Field | Value |
|-------|-------|
| Week start | `2031-09-01` (Monday) |
| Weekdays | `2031-09-01` → `2031-09-05` |
| Mode | `categoryScope=all_supported` · `overwriteMode=create_missing_only_strict` · `dryRun=true` |
| HTTP / ok | **200 / true** |
| RID | `prov_mapply_mr8f315z_m4bq19383796gu3g` |
| supportedCategories | **8/8** |
| unsupportedCategories | **`[]`** |
| Catalog updates | **0** (`wouldUpdate=[]`) |
| wouldCreate (catalog plan) | **`vegetarian`** (no provider-scoped vegetarian doc yet) |
| wouldSkip | sandwich · salad · sushi · poke · asian |
| Plan summary | `createdDraftDays=5` · `createdCategories=6` · `totalGeneratedItems=30` |
| Pre-apply menuDays | **0** |
| Mutation performed | **false** |

---

## 6. Safety regression

| Check | Result |
|-------|--------|
| Order count | **17 → 17** (unchanged) |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** (allowed provider / org / settings / auth rows only) |
| Production Sanity | **UNCHANGED** |
| Production flags | **UNCHANGED** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Production apply | **NOT RUN** |
| Rollback needed | **NO** |
| Rollback performed | **NO** |

---

## 7. Known risks

1. **First non-nb production provider** — requires separate scoped GO for any apply.
2. **No provider-scoped Sanity catalog seeded** — apply plan includes `would_create_category` for **vegetarian** (Melhus had existing provider vegetarian doc).
3. **Global chrome** may contain nb strings unrelated to provider menu surface.
4. **SOT: NO-GO** · **Auto-rollout: NO-GO** (unchanged).
5. **Automation credentials** provisioned operator-side only — not stored in repo.

---

## 8. Rollback boundary (not executed)

Rollback was **not needed**. If required after failed onboarding (before apply GO):

- Remove `provider_memberships` for new provider only
- Remove `provider_settings` for new provider only
- Remove `organizations` mirror for new provider only
- Remove `providers` row for new provider only
- Disable/remove provisioned auth user for new provider only

**Forbidden:** Melhus rows · orders · global Sanity templates · published docs

---

## 9. Decision

| Item | Verdict |
|------|---------|
| **Provider #2 onboarding** | **PASS** |
| **Provider #2 dryRun ready** | **YES** |
| **Provider #2 apply ready** | **CONDITIONAL GO** — separate scoped apply GO required |
| **SOT readiness** | **NO-GO** (unchanged) |
| **Auto-rollout** | **NO-GO** (unchanged) |

**Next step (not authorized by this document):** Scoped production apply GO for Swedish Lunch Pilot week `2031-09-01` only, if operator approves.

**Do not** run production apply, start SOT, or start auto-rollout without separate operator GO.

---

## 10. Related documents

| Document | Role |
|----------|------|
| [`phase-b-melhus-2031-08-04-apply-evidence.md`](./phase-b-melhus-2031-08-04-apply-evidence.md) | Melhus Phase B apply (nb-NO reference) |
| [`phase-b-melhus-production-apply-evidence.md`](./phase-b-melhus-production-apply-evidence.md) | First Melhus Phase B apply |
| [`localized-generator-9-locale-staging-matrix-evidence.md`](./localized-generator-9-locale-staging-matrix-evidence.md) | sv-SE staging matrix PASS |
| [`../runbooks/localized-generator-sot-rollout-readiness.md`](../runbooks/localized-generator-sot-rollout-readiness.md) | Rollout runbook |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
