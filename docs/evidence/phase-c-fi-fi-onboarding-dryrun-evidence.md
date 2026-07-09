# Phase C — fi-FI provider onboarding dryRun evidence

**Status:** Evidence archived · docs-only · **onboarding dryRun-only PASS**  
**Date:** 2026-07-07  
**Main HEAD (archive):** `56e2d37d` — docs(menu): archive Phase C da-DK generator apply evidence (#435)  
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**  
**Operator:** Cursor agent (Phase C fi-FI onboarding dryRun-only; no apply · no generator · no SOT · no auto-rollout)

This document records **verification evidence** for the official Phase C provider onboarding **dryRun-only** session for **Finnish Lunch Pilot** (`fi-FI`). No onboarding apply, no provider creation, no Sanity mutation, no menu apply.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase C** — fi-FI provider onboarding **dryRun-only** |
| Market | **fi-FI only** (next pending locale after da-DK) |
| Provider | Finnish Lunch Pilot |
| Slug | `finnish-lunch-pilot` |
| Locale / profile | `fi-FI` / `finnish_office_lunch` |
| Country / currency | FI / EUR |
| Timezone | `Europe/Helsinki` |
| Admin email | `finnish-lunch-pilot-admin@lunchportalen.no` |
| Safe future week | `2031-11-10` |
| Session type | Onboarding **dryRun-only** |
| Onboarding apply | **NOT RUN** |
| Generator apply | **NOT RUN** |
| Provider creation | **NOT RUN** |
| Sanity mutation | **NOT RUN** |
| menuDays | **NOT CREATED** |
| Catalog docs | **NOT CREATED** |
| Publish | **NOT RUN** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
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

**Expected inventory before onboarding:** **`BLOCKED_PROVIDER`** (no provider row)

---

## 3. Production baseline

| Check | Result |
|-------|--------|
| `liveReadEnv` | Production Supabase + production Sanity **aligned** |
| Provider count | **3** |
| Orders (global) | **17** |
| Orders (Danish) | **0** |
| Orders (Melhus) | **17** |
| Orders (Swedish) | **0** |
| `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| `da-DK` | Provider exists · target week **15 menuDays** (stable post-#435) |
| `fi-FI` | **BLOCKED_PROVIDER** · no provider row |
| Slug conflict | **None** |
| Email conflict | **None** |
| Sanity mirror conflict | **None** |
| fi-FI menuDays | **0** |
| fi-FI catalog docs | **0** |

---

## 4. Official dryRun

| Field | Value |
|-------|-------|
| CLI | `scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs --dry-run --snapshot-source=live` |
| Exit | **0** |
| Mode | `dry_run` |
| Status | **`DRY_RUN_OK`** |
| Snapshot source | **`live`** |
| Validation | **`ok=true`** · **`blockers=[]`** |
| Global templates | **PASS** |
| Slug conflict | **none** |
| Email conflict | **none** |
| Would create provider | **Yes** (plan step 1 — not executed) |
| Would create org mirror | **Yes** (step 2) |
| Would create settings | **Yes** (step 3) |
| Would create auth user | **Yes** (step 4) |
| Would create membership | **Yes** (step 5) |
| Would create Sanity mirror | **Yes** (step 6 — `syncProviderToSanity`) |
| Write plan | **Present** (7 steps) |
| Rollback plan | **Present** (5 steps) |
| Writes | **`0`** · `liveWrites=false` |
| `passwordPrinted` | **`false`** |
| `secretsRedacted` | **`true`** |
| `willCreateMenuDays` | **`false`** |
| `willPublish` | **`false`** |
| `willStartSot` | **`false`** |
| Protected providers untouched | **`true`** |

### Inventory (live read)

| Locale | Classification |
|--------|----------------|
| `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| `da-DK` | **BLOCKED_CREDS** (onboarded; inventory automation flag design) |
| `fi-FI` | **BLOCKED_PROVIDER** |
| Remaining locales | **BLOCKED_PROVIDER** |

---

## 5. Post-dryRun read-back

| Check | Before → After |
|-------|----------------|
| Provider count | **3 → 3** |
| Orders | **17 → 17** |
| fi-FI provider created | **No** |
| fi-FI Sanity mirror | **No** |
| fi-FI menuDays / catalog | **0 / 0** |
| Melhus | **Untouched** |
| Swedish Lunch Pilot | **Untouched** |
| Danish Lunch Pilot | **Untouched** (15 target-week menuDays unchanged) |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

---

## 6. Gates

| Gate | Result |
|------|--------|
| `npm run lint` | **PASS** |
| `npm run ci:commercial-hardcodes-guard` | **PASS** |

---

## 7. Safety

| Check | Result |
|-------|--------|
| Onboarding apply | **NOT RUN** |
| Generator apply | **NOT RUN** |
| Provider mutation | **None** |
| Sanity mutation | **None** |
| menuDays | **None** |
| Publish | **NOT RUN** |
| Order write-path | **NOT TOUCHED** |
| `lp_order_set` | **NOT TOUCHED** |
| DB / RLS | **UNCHANGED** |
| Production flags | **UNCHANGED** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| Secrets / password / env committed | **NO** |

---

## 8. Known risks

1. **Onboarding apply remains gated** by `ONBOARD_PROVIDER_APPLY` and `PHASE_C_ALLOW_LIVE_ONBOARD=1` under separate scoped GO.
2. **No menu/generator apply** before post-onboard generator dryRun PASS and evidence archive.
3. **fi-FI is ready for onboarding apply only** with explicit separate GO — not generator apply yet.
4. **Admin credentials** must remain operator-local (`FI_FI_PROVIDER_ADMIN_*` pattern); never commit or print passwords.
5. **SOT: NO-GO** · **Auto-rollout: NO-GO** (unchanged).

---

## 9. Next action

| Item | Action |
|------|--------|
| This document | **Archive evidence** (docs-only PR) |
| Onboarding apply | **Separate scoped GO only** |
| Generator apply | **Not authorized** until post-onboard dryRun PASS |
| SOT / auto-rollout | **Do not start** |

**Exact next GO prompt (separate scoped GO only):**

```text
GO Phase C fi-FI provider onboarding apply-only — Finnish Lunch Pilot (slug=finnish-lunch-pilot, locale=fi-FI, confirm=ONBOARD_PROVIDER_APPLY)
```

**Do not** run onboarding apply, generator apply, publish, start SOT, or start auto-rollout without separate operator GO.

---

## 10. Related documents

| Document | Role |
|----------|------|
| [`phase-c-da-dk-provider-onboarding-evidence.md`](./phase-c-da-dk-provider-onboarding-evidence.md) | Prior da-DK onboarding evidence |
| [`phase-c-da-dk-generator-apply-evidence.md`](./phase-c-da-dk-generator-apply-evidence.md) | Prior da-DK generator apply evidence |
| [`phase-c-9-country-launch-readiness-plan.md`](./phase-c-9-country-launch-readiness-plan.md) | Phase C readiness plan |
| [`../runbooks/phase-c-9-country-provider-rollout.md`](../runbooks/phase-c-9-country-provider-rollout.md) | Phase C operator rollout control |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
