# Phase C — de-DE provider onboarding dryRun evidence (2031-11-24 target week)

**Status:** Evidence archived · docs-only · **provider onboarding dryRun-only PASS**
**Date:** 2026-07-07
**Main HEAD (execution):** `c9eae034` — docs(menu): archive Phase C en-GB generator apply evidence (#442)
**Environment:** Production — Supabase (`hkpokyapzarefrgqzkos`) · Sanity dataset **`production`** (read-only preflight)
**Operator:** Cursor agent (Phase C de-DE provider onboarding dryRun-only; no writes · no apply · no publish · no SOT · no auto-rollout)

This document records **verification evidence** for the **Phase C de-DE** provider onboarding **dryRun-only** preflight for **German Lunch Pilot**. Read-only production baseline · official onboarding CLI in `--dry-run` mode · post-dryRun read-back. **Zero writes.**

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase C** — de-DE provider onboarding dryRun-only |
| Market | **de-DE only** |
| Provider | German Lunch Pilot |
| Slug | `german-lunch-pilot` |
| Locale | `de-DE` |
| Menu profile | `german_business_lunch` |
| Country / currency | **DE / EUR** |
| Timezone | `Europe/Berlin` |
| Admin email | `german-lunch-pilot-admin@lunchportalen.no` |
| Safe future week | `2031-11-24` |
| Rollout order | 4 |
| Onboarding apply | **NOT RUN** |
| Generator apply | **NOT RUN** |
| Provider creation | **NOT RUN** |
| Sanity mutation | **NOT RUN** |
| menuDays | **NONE** |
| Publish | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

---

## 2. Source resolution

- Target resolved from repository source only:
  - `lib/provider-onboarding/phaseCLocales.ts`
  - `lib/menu-profile/registry.ts`
- **Source-authoritative menu profile:** `german_business_lunch`
  - Registered in `MENU_PROFILES` (`registry.ts`) with `id: "german_business_lunch"`, `market: "DE"`, `locale: "de-DE"`.
- **Note:** `german_office_lunch` was named in an earlier prompt as expected, but **source confirms `german_business_lunch`**. `german_office_lunch` **does not exist** and must not be used.
- Expected inventory classification before onboarding: **`BLOCKED_PROVIDER`** (confirmed).

---

## 3. Production baseline (read-only)

| Item | State |
|------|-------|
| liveReadEnv | Production Supabase + production Sanity aligned |
| Provider count before | **5** |
| Orders before | **17** |
| nb-NO | READY_FOR_SCOPED_APPLY |
| sv-SE | READY_FOR_SCOPED_APPLY |
| da-DK | READY_FOR_DRYRUN |
| fi-FI | READY_FOR_DRYRUN |
| en-GB | READY_FOR_DRYRUN |
| de-DE | **BLOCKED_PROVIDER · providerExists=false** |
| Slug conflict | none |
| Email conflict | none |
| Sanity mirror conflict | none |
| de-DE menuDays | 0 |
| de-DE catalog docs | 0 |

---

## 4. Official dryRun

| Item | State |
|------|-------|
| CLI | `node scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs --dry-run --snapshot-source live --locale de-DE` |
| Exit | **0** |
| Mode | `dry_run` |
| Status | **DRY_RUN_OK** |
| Snapshot source | `live` |
| Validation | `ok=true` · `blockers=[]` |
| Would create provider | yes |
| Would create org mirror | yes |
| Would create settings | yes |
| Would create auth user | yes |
| Would create membership | yes |
| Would create Sanity mirror | yes |
| Write plan | present · **7 steps** |
| Rollback plan | present · **5 steps** |
| Writes | **0** |
| liveWrites | **false** |
| Password printed | **false** |
| Secrets redacted | **true** |
| globalTemplates | **PASS** |
| safeToOnboardApply | **false** |
| confirmationPhraseRequired | `ONBOARD_PROVIDER_APPLY` |

**Write plan steps (dryRun preview only):**
1. `lp_provider_create` → providers (slug=german-lunch-pilot, via approved RPC path)
2. `organizations_insert` → organizations mirror (id=providerId, type=provider)
3. `provider_settings_upsert` → locale=de-DE, menu_profile_id=german_business_lunch, country=DE, currency=EUR, timezone=Europe/Berlin
4. `provider_admin_auth_provision` → auth.users + profiles (password never printed)
5. `provider_membership_upsert` → provider_admin membership (new provider only)
6. `syncProviderToSanity` → sanity.provider mirror upsert + read-only verify
7. `post_onboard_verify_read_only` → read-only verification (no menuDays, no publish, no SOT)

---

## 5. Post-dryRun read-back

| Item | State |
|------|-------|
| Provider count | **5 → 5** |
| Orders | **17 → 17** |
| de-DE provider created | **no** |
| de-DE Sanity mirror created | **no** |
| de-DE menuDays / catalog | **0 / 0** |
| Melhus | untouched |
| Swedish Lunch Pilot | untouched |
| Danish Lunch Pilot | untouched |
| Finnish Lunch Pilot | untouched |
| UK Lunch Pilot | untouched |
| SOT | not started |
| Auto-rollout | not started |

---

## 6. Gates

| Gate | Result |
|------|--------|
| lint | **PASS** — design-token warnings only, pre-existing |
| commercial-hardcodes-guard | **PASS** — 1028/1028 allowlisted |

---

## 7. Safety

| Item | State |
|------|-------|
| Onboarding apply | not run |
| Generator apply | not run |
| Provider mutation | none |
| Sanity mutation | none |
| MenuDays | none |
| Publish | not run |
| Order write-path | untouched |
| `lp_order_set` | untouched |
| DB / RLS | no migration |
| Production flags | unchanged |
| SOT | not started |
| Auto-rollout | not started |
| Batch apply | not run |
| Publish-as-apply | not run |

---

## 8. Known risk

- de-DE onboarding apply remains gated by:
  - `ONBOARD_PROVIDER_APPLY`
  - `PHASE_C_ALLOW_LIVE_ONBOARD=1`
  - `confirm=ONBOARD_PROVIDER_APPLY`
- Menu profile is **`german_business_lunch`**, not `german_office_lunch`.
- No menu/generator apply before post-onboard generator dryRun PASS.
- de-DE is ready for onboarding apply **only** with a separate scoped GO.
- **SOT remains NO-GO.**
- **Auto-rollout remains NO-GO.**

---

## 9. Next action

1. Archive this evidence first (this PR).
2. Then run de-DE onboarding apply-only under explicit separate GO:
   - provider = German Lunch Pilot
   - slug = german-lunch-pilot
   - locale = de-DE
   - menuProfileId = german_business_lunch
   - country = DE
   - currency = EUR
   - timezone = Europe/Berlin
   - adminEmail = german-lunch-pilot-admin@lunchportalen.no
   - confirm = ONBOARD_PROVIDER_APPLY
3. **Do not** start SOT.
4. **Do not** auto-rollout.
5. **Do not** run generator apply yet.
