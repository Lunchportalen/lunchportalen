# Phase C — en-GB provider onboarding apply evidence

**Status:** Evidence archived · docs-only · **onboarding apply-only PASS — CLASS B**
**Date:** 2026-07-07
**Main HEAD (execution):** `e0616562` — docs(menu): archive Phase C en-GB onboarding dryRun evidence (#440)
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**
**Operator:** Cursor agent (Phase C en-GB onboarding apply-only + generator dryRun-only; no menu apply · no SOT · no auto-rollout)

This document records **verification evidence** for the controlled Phase C provider onboarding **apply-only** session for **UK Lunch Pilot** (`en-GB`). Onboarding apply-only and production generator dryRun-only — no menu apply session.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase C** — en-GB provider onboarding **apply-only** |
| Market | **en-GB only** (next pending locale after fi-FI) |
| Provider | UK Lunch Pilot |
| Provider ID | `e9b90cbf-8f6e-4523-94e2-49263ca61896` |
| Slug | `uk-lunch-pilot` |
| Locale / profile | `en-GB` / `uk_office_lunch` |
| Country / currency | GB / GBP |
| Timezone | `Europe/London` |
| Admin email | `uk-lunch-pilot-admin@lunchportalen.no` |
| Safe future week | `2031-11-17` |
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
| Provider name | UK Lunch Pilot | `lib/provider-onboarding/phaseCLocales.ts` |
| Slug | `uk-lunch-pilot` | `phaseCLocales.ts` |
| Locale | `en-GB` | `phaseCLocales.ts` |
| menuProfileId | `uk_office_lunch` | `phaseCLocales.ts` · `lib/menu-profile/registry.ts` |
| Country | GB | `phaseCLocales.ts` |
| Currency | GBP | `phaseCLocales.ts` |
| Timezone | `Europe/London` | `phaseCLocales.ts` |
| Safe future week | `2031-11-17` | `phaseCLocales.ts` (`PHASE_C_SAFE_FUTURE_WEEKS`) |
| Admin email | `uk-lunch-pilot-admin@lunchportalen.no` | `lib/provider-onboarding/phaseCOnboardCli.ts` (CLI default `{slug}-admin@lunchportalen.no`) |

**Matched PR #440 dryRun evidence:** provider name, slug, locale, menuProfileId, country, currency, timezone, admin email, and safe future week all **aligned**.

---

## 3. Pre-apply baseline

| Check | Result |
|-------|--------|
| Main HEAD at execution | `e0616562` — docs(menu): archive Phase C en-GB onboarding dryRun evidence (#440) |
| Live-write adapter support | On `origin/main` via **#437** (`0ca874ca`) — no cherry-picks needed |
| `liveReadEnv` | Production Supabase + production Sanity **aligned** |
| Provider count | **4** |
| Orders (global) | **17** |
| `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| `da-DK` | **READY_FOR_DRYRUN** |
| `fi-FI` | **READY_FOR_DRYRUN** |
| `en-GB` | **BLOCKED_PROVIDER** · no provider row |
| Slug conflict | **None** |
| Email conflict | **None** |
| Sanity mirror conflict | **None** |
| en-GB menuDays | **0** |
| en-GB catalog docs | **0** |

---

## 4. Pre-apply dryRun

| Field | Value |
|-------|-------|
| CLI | `scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs --dry-run --snapshot-source live --locale en-GB` |
| Exit | **0** |
| Mode | `dry_run` |
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
| Matched PR #440 dryRun evidence | **Yes** |

---

## 5. Apply-only onboarding

| Field | Value |
|-------|-------|
| CLI | `scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs --apply --snapshot-source live --locale en-GB --confirm ONBOARD_PROVIDER_APPLY` |
| Exit | **0** |
| Mode | `apply` |
| Status | **`APPLY_OK`** |
| Confirm | `ONBOARD_PROVIDER_APPLY` |
| Flags | `PHASE_C_ALLOW_LIVE_ONBOARD=1` · `ONBOARD_PROVIDER_APPLY=1` |

**Created:**

| Row / artifact | Result |
|----------------|--------|
| Provider row | **Created** · ID `e9b90cbf-8f6e-4523-94e2-49263ca61896` |
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
| Provider row | **Exists** · slug=`uk-lunch-pilot` · name=`UK Lunch Pilot` · status=`ACTIVE` |
| Organization mirror | **Exists** · `type=provider` |
| `provider_settings` | locale=`en-GB` · menu_profile_id=`uk_office_lunch` · country=`GB` · currency=`GBP` · timezone=`Europe/London` |
| Provider admin auth | **Present** · role=`provider_admin` |
| `provider_membership` | **1** · scoped to en-GB provider |
| Sanity mirror | **Exists** · id/slug match provider |
| `providerRef` | **Resolves** |
| `providerMirrorPreflight.ok` | **`true`** |
| Provider count | **4 → 5** |
| Orders | **17 → 17** (unchanged) |
| en-GB menuDays | **0** |
| en-GB catalog docs | **0** |
| Melhus | **Untouched** |
| Swedish Lunch Pilot | **Untouched** |
| Danish Lunch Pilot | **Untouched** |
| Finnish Lunch Pilot | **Untouched** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

**Classification:** **CLASS B — onboarding succeeded safely**

---

## 7. Post-onboard inventory

| Locale | Classification |
|--------|----------------|
| `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| `da-DK` | **READY_FOR_DRYRUN** |
| `fi-FI` | **READY_FOR_DRYRUN** |
| `en-GB` | **READY_FOR_DRYRUN** |
| `de-DE` | **BLOCKED_PROVIDER** |
| `fr-FR` | **BLOCKED_PROVIDER** |
| `es-ES` | **BLOCKED_PROVIDER** |
| `it-IT` | **BLOCKED_PROVIDER** |

`en-GB` advanced from **BLOCKED_PROVIDER** (pre-onboard) to **READY_FOR_DRYRUN** (post-onboard).

---

## 8. Generator dryRun-only (en-GB)

| Field | Value |
|-------|-------|
| Generator apply | **NOT RUN** |
| Week start | `2031-11-17` (Monday) |
| RID | `prov_mapply_mrakcpeh_szncz3zo37u47cjh` |
| HTTP | **200** |
| `ok` | **`true`** |
| `dryRun` | **`true`** |
| `providerMirrorPreflight.ok` | **`true`** |
| `safeToApply` | **`true`** |
| `applyBlocked` | **`false`** |
| locale | `en-GB` |
| menuProfileId | `uk_office_lunch` |
| `unsupportedCategories` | **`0`** |
| Mutation performed | **`false`** |
| UK/English categories | **Sandwiches · Salads · Hot meals · Sushi · Poké bowls · Asian · Vegetarian** |
| Content examples | **Coronation chicken · Shepherd's pie · Chicken Caesar salad** |
| Norwegian fallback | **None in menu content** (backend operator status labels only, same as fi-FI/da-DK) |
| Forbidden hits | **`[]`** |
| Employee economy exposure | **None** |
| Employee metadata exposure | **None** |
| Plan only | `createdDraftDays=5` · `createdCategories=6` |
| en-GB menuDays after dryRun | **0** |

---

## 9. Safety

| Check | Result |
|-------|--------|
| Provider count | **4 → 5** (UK Lunch Pilot only) |
| Order count | **17 → 17** (unchanged) |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** (allowed provider / org / settings / auth / membership rows only) |
| Production flags | **UNCHANGED** |
| Production Sanity changed only by | **en-GB provider mirror** (`syncProviderToSanity`) |
| menuDays | **None created** |
| Catalog docs | **None created** |
| Publish | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| Rollback needed | **NO** |
| Rollback performed | **NO** |
| Secrets / password / env committed | **NO** |
| `passwordPrinted` | **`false`** |
| `secretsRedacted` | **`true`** |

---

## 10. Known risks

1. **`en-GB` is `READY_FOR_DRYRUN`, not scoped-applied** — menu/generator apply still requires a separate scoped GO.
2. **Generator apply still requires separate scoped GO** — dryRun confirmed `safeToApply=true` only.
3. **Admin credentials** must remain operator-local (`.operator-local/`); never commit or print passwords.
4. **`syncProviderToSanity` remains mandatory** before first generator apply; provider mirror preflight continues to enforce mirror presence.
5. **SOT: NO-GO** · **Auto-rollout: NO-GO** (unchanged).

---

## 11. Next action

| Item | Action |
|------|--------|
| This document | **Archive evidence** (docs-only PR) |
| Generator apply | **Separate scoped GO only** |
| SOT / auto-rollout | **Do not start** |

**Exact next GO prompt (separate scoped GO only):**

```text
GO Phase C en-GB generator apply-only — UK Lunch Pilot
(providerId=e9b90cbf-8f6e-4523-94e2-49263ca61896, slug=uk-lunch-pilot,
locale=en-GB, menuProfileId=uk_office_lunch, weekStart=2031-11-17,
categoryScope=all_supported, overwriteMode=create_missing_only_strict).
Forbidden: SOT, auto-rollout, Melhus/Swedish/Danish/Finnish mutation, publish-as-apply.
```

**Do not** run generator apply, publish, start SOT, or start auto-rollout without separate operator GO.

---

## 12. Related documents

| Document | Role |
|----------|------|
| [`phase-c-en-gb-onboarding-dryrun-evidence.md`](./phase-c-en-gb-onboarding-dryrun-evidence.md) | Prior en-GB dryRun evidence (PR #440) |
| [`phase-c-fi-fi-onboarding-apply-evidence.md`](./phase-c-fi-fi-onboarding-apply-evidence.md) | Prior fi-FI onboarding apply evidence (PR #438) |
| [`phase-c-fi-fi-generator-apply-evidence.md`](./phase-c-fi-fi-generator-apply-evidence.md) | Prior fi-FI generator apply evidence (PR #439) |
| [`../runbooks/phase-c-9-country-provider-rollout.md`](../runbooks/phase-c-9-country-provider-rollout.md) | Phase C operator rollout control |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
