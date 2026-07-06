# Phase C — da-DK provider onboarding evidence

**Status:** Evidence archived · docs-only · **onboarding apply-only + generator dryRun PASS**  
**Date:** 2026-07-06  
**Production commit:** `4749574941b64c35dfe8933f7251bc5d577f165f`  
**Environment:** Production — `https://app.lunchportalen.no` · Sanity dataset **`production`**  
**Operator:** Cursor agent (Phase C da-DK onboarding apply-only + generator dryRun-only; no menu apply · no SOT · no auto-rollout)

This document records **verification evidence** for the first Phase C locale provider onboarded under controlled apply-only onboarding: **Danish Lunch Pilot** (`da-DK`). Onboarding apply-only and production generator dryRun-only — no menu apply session.

**No secret values, tokens, passwords, connection strings, env values, or private tenant PII are recorded.**

---

## 1. Scope

| Item | State |
|------|-------|
| Phase | **Phase C** — da-DK provider onboarding apply-only |
| Market | **da-DK only** (first Phase C locale after nb-NO / sv-SE coverage) |
| Provider | Danish Lunch Pilot |
| Provider ID | `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| Slug | `danish-lunch-pilot` |
| Session type | Onboarding **apply-only** + generator **dryRun-only** |
| Menu apply | **NOT RUN** |
| menuDays | **NOT CREATED** |
| Publish | **NOT RUN** |
| Batch apply | **NOT RUN** |
| Publish-as-apply | **NOT RUN** |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |
| Sanity mutation | **Provider mirror only** (`syncProviderToSanity`) — no menuDays / catalog / publish |
| Order write-path · `lp_order_set` | **NOT TOUCHED** |
| DB / RLS migration | **NOT RUN** |

---

## 2. Preflight

| Check | Result |
|-------|--------|
| Production commit | `47495749` — PR #433 live-read dryRun support (or newer inclusive) |
| Official CLI live dryRun | **PASS** |
| `snapshotSource` | **`live`** |
| `liveReadEnv` | Production Supabase + production Sanity **aligned** |
| Validation | **`ok=true`** |
| Blockers | **`[]`** |
| Writes | **`writes=0`** · `liveWrites=false` |
| Global templates | **PASS** |
| Slug / email conflict | **None** |
| Locale classification before onboarding | |
| · `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| · `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| · `da-DK` | **BLOCKED_PROVIDER** (provider missing — pre-onboard) |

---

## 3. Apply-only onboarding

| Field | Value |
|-------|-------|
| Provider name | Danish Lunch Pilot |
| Provider ID | `799ba3a2-a127-48a0-87b7-87944a2f42a3` |
| Slug | `danish-lunch-pilot` |
| Locale | `da-DK` |
| menuProfileId | `danish_office_lunch` |
| Country / currency | DK / DKK |
| Timezone | `Europe/Copenhagen` |
| Creation path | Phase C onboarding apply-only (`ONBOARD_PROVIDER_APPLY`) |

**Created:**

| Row / artifact | Result |
|----------------|--------|
| Provider row | **Created** |
| Organization mirror | **Created** (`id=providerId`, `type=provider`) |
| `provider_settings` | **Created** (locale / menuProfileId / country / currency / timezone) |
| Provider admin auth | **Present** (operator-local credentials; password not printed) |
| `provider_memberships` | **Present** (`provider_admin`) |
| Sanity provider mirror | **Created** via `syncProviderToSanity` |
| Mirror id / slug | **Match** Supabase |
| `providerMirrorPreflight.ok` | **`true`** |
| `providerRef` | **Resolves** |

**Not created:**

| Artifact | Result |
|----------|--------|
| menuDays | **Not created** (`0`) |
| Catalog docs | **Not created** |
| Published docs | **Not created** |

**Protected providers:** Melhus and Swedish Lunch Pilot **untouched**.

---

## 4. Read-back

| Check | Result |
|-------|--------|
| Provider row exists | **Yes** |
| Organization mirror exists | **Yes** |
| `provider_settings` exist | **Yes** |
| Provider admin auth present | **Yes** |
| `provider_membership` `provider_admin` present | **Yes** |
| Sanity mirror id/slug match | **Yes** |
| `providerRef` resolves | **Yes** |
| `passwordPrinted` | **`false`** |
| `secretsRedacted` | **`true`** |
| Melhus | **Untouched** |
| Swedish Lunch Pilot | **Untouched** |
| Orders | **Untouched** (`17 → 17`) |
| menuDays `da-DK` | **`0`** (unchanged) |

---

## 5. Post-onboard inventory

| Locale | Classification |
|--------|----------------|
| `nb-NO` | **READY_FOR_SCOPED_APPLY** |
| `sv-SE` | **READY_FOR_SCOPED_APPLY** |
| `da-DK` | **READY_FOR_DRYRUN** |
| `fi-FI` | **BLOCKED_PROVIDER** |
| `de-DE` | **BLOCKED_PROVIDER** |
| `en-GB` | **BLOCKED_PROVIDER** |
| `fr-FR` | **BLOCKED_PROVIDER** |
| `es-ES` | **BLOCKED_PROVIDER** |
| `it-IT` | **BLOCKED_PROVIDER** |

`da-DK` advanced from **BLOCKED_PROVIDER** (pre-onboard) to **READY_FOR_DRYRUN** (post-onboard). It is **not** yet **READY_FOR_SCOPED_APPLY**.

---

## 6. Generator dryRun (da-DK)

| Field | Value |
|-------|-------|
| Week start | `2031-11-03` (Monday) |
| HTTP | **200** |
| `ok` | **`true`** |
| `dryRun` | **`true`** |
| `providerMirrorPreflight.ok` | **`true`** |
| `safeToApply` | **`true`** |
| `applyBlocked` | **`false`** |
| locale | `da-DK` |
| menuProfileId | `danish_office_lunch` |
| Danish labels | **Smørrebrød · Salater · Varm ret · Vegetarisk** |
| Forbidden hits | **`[]`** |
| `unsupportedCategories` | **`0`** |
| Draft days would-create | **5** |
| Catalog updates | **`null`** / none applied |
| Mutation performed | **`false`** |
| menuDays `da-DK` | **`0 → 0`** |
| Melhus / Swedish menuDays | **Unchanged** |
| Providers / orders | **`3 / 17`** (providers `2 → 3`; orders unchanged) |
| Employee economy exposure | **None** |
| Employee metadata exposure | **None** |

---

## 7. Safety regression

| Check | Result |
|-------|--------|
| Provider count | **2 → 3** (Danish Lunch Pilot only) |
| Order count | **17 → 17** (unchanged) |
| Production Sanity | **Changed only by Danish provider mirror** (`syncProviderToSanity`) |
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
| Secrets / password / env values committed | **NO** |
| `passwordPrinted` | **`false`** |
| `secretsRedacted` | **`true`** |
| Melhus | **Untouched** |
| Swedish Lunch Pilot | **Untouched** |
| Rollback needed | **NO** |
| Rollback performed | **NO** |

---

## 8. Known risks

1. **`da-DK` is `READY_FOR_DRYRUN`, not `READY_FOR_SCOPED_APPLY`** — menu apply still requires a separate scoped GO.
2. **DryRun plan includes would-create draft days** (`draft days would-create=5`) but **no mutation was performed**.
3. **Live onboarding credentials** must remain operator-local (`DA_DK_PROVIDER_ADMIN_*` pattern) and must **never** be committed.
4. **`syncProviderToSanity` remains mandatory** before first generator apply; PR #430 preflight continues to enforce mirror presence.
5. **SOT: NO-GO** · **Auto-rollout: NO-GO** (unchanged).

---

## 9. Rollback boundary (not executed)

Rollback was **not needed**. If required after failed onboarding (before apply GO):

- Remove `provider_memberships` for Danish Lunch Pilot only
- Remove `provider_settings` for Danish Lunch Pilot only
- Remove `organizations` mirror for Danish Lunch Pilot only
- Remove `providers` row for Danish Lunch Pilot only
- Disable/remove provisioned auth user for Danish Lunch Pilot only
- Remove Sanity provider mirror for Danish Lunch Pilot only

**Forbidden:** Melhus rows · Swedish Lunch Pilot rows · orders · global Sanity templates · published docs · menuDays for any provider

---

## 10. Decision

| Item | Verdict |
|------|---------|
| **da-DK onboarding apply-only** | **PASS** |
| **da-DK generator dryRun** | **PASS** (`safeToApply=true`) |
| **da-DK menu apply ready** | **CONDITIONAL GO** — separate scoped apply GO required |
| **Classification** | **READY_FOR_DRYRUN** (not yet READY_FOR_SCOPED_APPLY) |
| **SOT readiness** | **NO-GO** (unchanged) |
| **Auto-rollout** | **NO-GO** (unchanged) |

**Next step (not authorized by this document):** Scoped production generator apply GO for Danish Lunch Pilot week `2031-11-03` only, if operator approves.

**Exact next GO prompt (separate scoped GO only):**

```text
GO Phase C da-DK generator apply-only for Danish Lunch Pilot week 2031-11-03
```

**Do not** run production menu apply, create menuDays, publish, start SOT, or start auto-rollout without separate operator GO.

---

## 11. Related documents

| Document | Role |
|----------|------|
| [`phase-c-9-country-launch-readiness-plan.md`](./phase-c-9-country-launch-readiness-plan.md) | Phase C readiness plan / inventory baseline |
| [`../runbooks/phase-c-9-country-provider-rollout.md`](../runbooks/phase-c-9-country-provider-rollout.md) | Phase C operator rollout control |
| [`phase-b-provider-2-sv-se-onboarding-evidence.md`](./phase-b-provider-2-sv-se-onboarding-evidence.md) | Prior Phase B provider #2 (sv-SE) onboarding evidence |
| [`phase-b-sv-se-production-apply-evidence.md`](./phase-b-sv-se-production-apply-evidence.md) | Prior sv-SE apply evidence (separate GO) |
| [`pr430-production-smoke-evidence.md`](./pr430-production-smoke-evidence.md) | Provider mirror preflight production smoke |

**Protected Golden Path impact:** None — order write-path, `lp_order_set`, and employee order flow unchanged.
