# Phase C — fi-FI provider onboarding apply evidence

**Status:** Evidence archived · docs-only · **onboarding apply-only PASS — CLASS B**  
**Date:** 2026-07-07  
**Main HEAD (archive):** `0ca874ca` — fix(menu): add Phase C live-write onboarding adapters (#437)  
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**  
**Operator:** Cursor agent (Phase C fi-FI onboarding apply-only + generator dryRun-only; no menu apply · no SOT · no auto-rollout)

This document records **verification evidence** for the controlled Phase C provider onboarding **apply-only** session for **Finnish Lunch Pilot** (`fi-FI`). Onboarding apply-only and production generator dryRun-only — no menu apply session.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase C** — fi-FI provider onboarding **apply-only** |
| Market | **fi-FI only** (next pending locale after da-DK) |
| Provider | Finnish Lunch Pilot |
| Provider ID | `3ce485a7-0bd6-4308-9381-f734692b667c` |
| Slug | `finnish-lunch-pilot` |
| Locale / profile | `fi-FI` / `finnish_office_lunch` |
| Country / currency | FI / EUR |
| Timezone | `Europe/Helsinki` |
| Admin email | `finnish-lunch-pilot-admin@lunchportalen.no` |
| Safe future week | `2031-11-10` |
| Session type | Onboarding **apply-only** + generator **dryRun-only** |
| Generator apply | **NOT RUN** |
| Menu apply | **NOT RUN** |
| menuDays | **NOT CREATED** |
| Catalog docs | **NOT CREATED** |
| Publish | **NOT RUN** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Sanity mutation | **Provider mirror only** (`syncProviderToSanity`) — no menuDays / catalog / publish |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS migration | **NOT RUN** |

---

## 2. Source resolution

Target resolved from repository source (no hardcoded guess):

| Field | Value | Source |
|-------|-------|--------|
| Provider name | Finnish Lunch Pilot | `lib/provider-onboarding/phaseCLocales.ts` |
| Slug | `finnish-lunch-pilot` | `phaseCLocales.ts` |
| Locale | `fi-FI` | `phaseCLocales.ts` |
| menuProfileId | `finnish_office_lunch` | `phaseCLocales.ts` |
| Country | FI | `phaseCLocales.ts` |
| Currency | EUR | `phaseCLocales.ts` |
| Timezone | `Europe/Helsinki` | `phaseCLocales.ts` |
| Safe future week | `2031-11-10` | `phaseCLocales.ts` · `docs/runbooks/phase-c-9-country-provider-rollout.md` |
| Admin email | `finnish-lunch-pilot-admin@lunchportalen.no` | CLI default (`{slug}-admin@lunchportalen.no`) |

**Matched PR #436 dryRun evidence:** provider name, slug, locale, menuProfileId, country, currency, timezone, admin email, and safe future week all **aligned**.

---

## 3. Pre-apply baseline

| Check | Result |
|-------|--------|
| Main HEAD at execution | `13ccdee0` — docs(menu): archive Phase C fi-FI onboarding dryRun evidence (#436) |
| Live-write adapter support | Local cherry-picks required at execution (`7b35b071`, `c3d09bd4`) because `origin/main` lacked `createLiveWriteAdapters`; **#437** later merged support to main as `0ca874ca` |
| `liveReadEnv` | Production Supabase + production Sanity **aligned** |
| Provider count | **3** |
| Orders (global) | **17** |
| `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| `da-DK` | **Stable** · **15 menuDays** for week `2031-11-03` |
| `fi-FI` | **BLOCKED_PROVIDER** · no provider row |
| Slug conflict | **None** |
| Email conflict | **None** |
| Sanity mirror conflict | **None** |
| fi-FI menuDays | **0** |
| fi-FI catalog docs | **0** |

---

## 4. Pre-apply dryRun

| Field | Value |
|-------|-------|
| CLI | `scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs --dry-run --snapshot-source=live` |
| Exit | **0** |
| Mode | `dry_run` |
| Status | **`DRY_RUN_OK`** |
| Snapshot source | **`live`** |
| Validation | **`ok=true`** · **`blockers=[]`** |
| Would create provider | **Yes** |
| Would create org mirror | **Yes** |
| Would create settings | **Yes** |
| Would create auth user | **Yes** |
| Would create membership | **Yes** |
| Would create Sanity mirror | **Yes** (`syncProviderToSanity`) |
| Writes | **`0`** |
| `passwordPrinted` | **`false`** |
| `secretsRedacted` | **`true`** |
| Matched PR #436 dryRun evidence | **Yes** |

---

## 5. Apply-only onboarding

| Field | Value |
|-------|-------|
| CLI | `scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs --apply --confirm=ONBOARD_PROVIDER_APPLY` |
| Exit | **0** |
| Mode | `apply` |
| Confirm | `ONBOARD_PROVIDER_APPLY` |
| Flags | `PHASE_C_ALLOW_LIVE_ONBOARD=1` · `ONBOARD_PROVIDER_APPLY=1` |
| Status | **`APPLY_OK`** |

**Created:**

| Row / artifact | Result |
|----------------|--------|
| Provider row | **Created** · ID `3ce485a7-0bd6-4308-9381-f734692b667c` |
| Organization mirror | **Created** (`id=providerId`, `type=provider`) |
| `provider_settings` | **Created** (locale / menuProfileId / country / currency / timezone) |
| Provider admin auth | **Present** (operator-local credentials; password not printed) |
| `provider_memberships` | **Present** (`provider_admin`) |
| Sanity provider mirror | **Created** via `syncProviderToSanity` |

**Steps completed:**

`lp_provider_create` → `organizations_mirror` → `provider_settings` → `provider_admin_auth` → `provider_membership` → `syncProviderToSanity` → `verify_sanity_mirror`

**Not created:**

| Artifact | Result |
|----------|--------|
| menuDays | **Not created** (`0`) |
| Catalog docs | **Not created** |
| Published docs | **Not created** |
| Generator menu output | **Not created** |
| Orders | **Not created** |
| SOT state | **Not started** |
| Auto-rollout state | **Not started** |

| Field | Value |
|-------|-------|
| `passwordPrinted` | **`false`** |
| `secretsRedacted` | **`true`** |
| Generator apply | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

---

## 6. Post-apply read-back

| Check | Result |
|-------|--------|
| Provider row | **Exists** · slug=`finnish-lunch-pilot` · name=`Finnish Lunch Pilot` · status=`ACTIVE` |
| Organization mirror | **Exists** · `type=provider` |
| `provider_settings` | locale=`fi-FI` · menu_profile_id=`finnish_office_lunch` · country=`FI` · currency=`EUR` · timezone=`Europe/Helsinki` |
| Provider admin auth | **Present** · role=`provider_admin` |
| `provider_membership` | **1** · scoped to fi-FI provider |
| Sanity mirror | **Exists** · id/slug match provider |
| `providerRef` | **Resolves** |
| `providerMirrorPreflight.ok` | **`true`** |
| Provider count | **3 → 4** |
| Orders | **17 → 17** (unchanged) |
| fi-FI menuDays | **0** |
| fi-FI catalog docs | **0** |
| Melhus | **Untouched** |
| Swedish Lunch Pilot | **Untouched** |
| Danish Lunch Pilot | **Untouched** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

---

## 7. Post-onboard inventory

| Locale | Classification |
|--------|----------------|
| `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| `da-DK` | **READY_FOR_DRYRUN** |
| `fi-FI` | **READY_FOR_DRYRUN** |
| `de-DE` | **BLOCKED_PROVIDER** |
| `en-GB` | **BLOCKED_PROVIDER** |
| `fr-FR` | **BLOCKED_PROVIDER** |
| `es-ES` | **BLOCKED_PROVIDER** |
| `it-IT` | **BLOCKED_PROVIDER** |

`fi-FI` advanced from **BLOCKED_PROVIDER** (pre-onboard) to **READY_FOR_DRYRUN** (post-onboard).

---

## 8. Generator dryRun-only (fi-FI)

| Field | Value |
|-------|-------|
| Generator apply | **NOT RUN** |
| Week start | `2031-11-10` (Monday) |
| HTTP | **200** |
| `ok` | **`true`** |
| `dryRun` | **`true`** |
| RID | `prov_mapply_mr9va0t8_u0r6ruut0ibsvvui` |
| `providerMirrorPreflight.ok` | **`true`** |
| `safeToApply` | **`true`** |
| `applyBlocked` | **`false`** |
| locale | `fi-FI` |
| menuProfileId | `finnish_office_lunch` |
| `unsupportedCategories` | **`0`** |
| Mutation performed | **`false`** |
| Finnish labels | **Voileivät · Salaatit · Lämmin ruoka · Kasvis** |
| Norwegian fallback | **None** |
| Forbidden hits | **`[]`** |
| Employee economy exposure | **None** |
| Employee metadata exposure | **None** |
| fi-FI menuDays after dryRun | **0** |

---

## 9. Safety

| Check | Result |
|-------|--------|
| Provider count | **3 → 4** (Finnish Lunch Pilot only) |
| Order count | **17 → 17** (unchanged) |
| Production Sanity | **Changed only by fi-FI provider mirror** (`syncProviderToSanity`) |
| menuDays | **None created** |
| Catalog docs | **None created** |
| Publish | **NOT RUN** |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** (allowed provider / org / settings / auth / membership rows only) |
| Production flags | **UNCHANGED** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| Menu generator apply | **NOT RUN** |
| Rollback needed | **NO** |
| Rollback performed | **NO** |
| Secrets / password / env committed | **NO** |
| `passwordPrinted` | **`false`** |
| `secretsRedacted` | **`true`** |

---

## 10. Known risks

1. **fi-FI onboarding apply was performed before live-write adapters were on `origin/main`.** Local cherry-picks were required at execution time.
2. **PR #437** has since merged live-write adapters to main as **`0ca874ca`**. Future locale onboarding applies should use main directly — no cherry-picks.
3. **`fi-FI` is `READY_FOR_DRYRUN`, not `READY_FOR_SCOPED_APPLY`** — menu apply still requires a separate scoped GO.
4. **Admin credentials** must remain operator-local (`.operator-local/`); never commit or print passwords.
5. **`syncProviderToSanity` remains mandatory** before first generator apply; provider mirror preflight continues to enforce mirror presence.
6. **SOT: NO-GO** · **Auto-rollout: NO-GO** (unchanged).

---

## 11. Next action

| Item | Action |
|------|--------|
| This document | **Archive evidence** (docs-only PR) |
| Generator apply | **Separate scoped GO only** |
| SOT / auto-rollout | **Do not start** |

**Exact next GO prompt (separate scoped GO only):**

```text
GO Phase C fi-FI generator apply-only — Finnish Lunch Pilot
(providerId=3ce485a7-0bd6-4308-9381-f734692b667c, slug=finnish-lunch-pilot,
locale=fi-FI, menuProfileId=finnish_office_lunch, weekStart=2031-11-10,
categoryScope=all_supported, overwriteMode=create_missing_only_strict).
Forbidden: SOT, auto-rollout, Melhus/Swedish/Danish mutation, publish-as-apply.
```

**Do not** run generator apply, publish, start SOT, or start auto-rollout without separate operator GO.

---

## 12. Related documents

| Document | Role |
|----------|------|
| [`phase-c-fi-fi-onboarding-dryrun-evidence.md`](./phase-c-fi-fi-onboarding-dryrun-evidence.md) | Prior fi-FI dryRun evidence (PR #436) |
| [`phase-c-da-dk-provider-onboarding-evidence.md`](./phase-c-da-dk-provider-onboarding-evidence.md) | Prior da-DK onboarding evidence |
| [`phase-c-da-dk-generator-apply-evidence.md`](./phase-c-da-dk-generator-apply-evidence.md) | Prior da-DK generator apply evidence |
| [`phase-c-9-country-launch-readiness-plan.md`](./phase-c-9-country-launch-readiness-plan.md) | Phase C readiness plan |
| [`../runbooks/phase-c-9-country-provider-rollout.md`](../runbooks/phase-c-9-country-provider-rollout.md) | Phase C operator rollout control |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
