# Phase C — 9-country launch readiness plan

**Status:** PLAN / CONTROL RELEASE · **SOT NO-GO** · **Auto-rollout NO-GO**  
**Date:** 2026-07-06  
**Main HEAD at authorship:** `88a22408` — PR #430 smoke evidence (#431)  
**Related control PR:** Phase C provider rollout factory + runbook  

This document is the **evidence-first readiness plan** for bringing remaining locales onto controlled provider onboarding before any additional production menu apply.

**No secret values, tokens, passwords, connection strings, or private tenant PII are recorded.**

---

## 1. Current production state

| Item | State |
|------|-------|
| Health | PASS (post PR #430 deploy) |
| Generator flags | `LP_MENU_PROFILE_RESOLVER=ON`, `LP_LOCALIZED_FIXED_MENU_GENERATOR=ON` |
| Provider mirror preflight | Enforced in code (PR #430) |
| Production smoke | DryRun-only PASS (PR #431 evidence) |
| SOT | **NOT STARTED** |
| Auto-rollout | **NOT STARTED** |

### Completed evidence chain

| PR | Outcome |
|----|---------|
| #415–#420 | Generator + apply safety + idempotency |
| #421–#429 | Production canaries, Phase B Melhus/sv-SE, runbook hardening |
| #430 | Provider mirror preflight guardrail (code) |
| #431 | PR #430 production dryRun smoke evidence |

---

## 2. Provider coverage matrix (read-only classification)

Classifications use Phase C inventory rules (`lib/provider-onboarding/phaseCInventoryClassify.ts`).

| Locale | Profile | Country/Currency | Provider | Mirror | Classification | Blockers |
|--------|---------|------------------|----------|--------|----------------|----------|
| `nb-NO` | `norwegian_company_lunch` | NO/NOK | Melhus `11111111-…` | PASS | **READY_FOR_SCOPED_APPLY** | none |
| `sv-SE` | `swedish_lunch` | SE/SEK | Swedish Lunch Pilot `a08e4742-…` | PASS | **READY_FOR_SCOPED_APPLY** | none |
| `da-DK` | `danish_office_lunch` | DK/DKK | — | — | **BLOCKED_PROVIDER** | provider missing |
| `fi-FI` | `finnish_office_lunch` | FI/EUR | — | — | **BLOCKED_PROVIDER** | provider missing |
| `en-GB` | `uk_office_lunch` | GB/GBP | — | — | **BLOCKED_PROVIDER** | provider missing |
| `de-DE` | `german_business_lunch` | DE/EUR | — | — | **BLOCKED_PROVIDER** | provider missing |
| `fr-FR` | `french_dejeuner` | FR/EUR | — | — | **BLOCKED_PROVIDER** | provider missing |
| `es-ES` | `spanish_menu_del_dia` | ES/EUR | — | — | **BLOCKED_PROVIDER** | provider missing |
| `it-IT` | `italian_office_lunch` | IT/EUR | — | — | **BLOCKED_PROVIDER** | provider missing |

### Covered provider snapshots (from PR #431 smoke)

**Melhus**

- settings: nb-NO / norwegian_company_lunch / NO / NOK
- orders: 17 (unchanged in smoke)
- dryRun week `2031-10-06` · `providerMirrorPreflight.ok=true` · `safeToApply=true` · `applyBlocked=false`

**Swedish Lunch Pilot**

- settings: sv-SE / swedish_lunch / SE / SEK
- orders: 0 (unchanged in smoke)
- dryRun week `2031-10-13` · labels Mackor/Sallader/Varmrätt/Vegetariskt · no nb fallback · `safeToApply=true`

Protected: onboarding factory **must not** mutate Melhus or Swedish Lunch Pilot.

---

## 3. Onboarding workflow

Factory:

- Planner: `lib/provider-onboarding/providerOnboardingPlan.ts`
- Live-read snapshot: `lib/provider-onboarding/liveReadSnapshot.ts` (read-only)
- Execute adapters: `lib/provider-onboarding/providerOnboardingExecute.ts`
- CLI: `scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs`
- Official dryRun: **must** use `--snapshot-source live` (default). Fixture is tests-only.
- Live dryRun does **not** require `PHASE_C_ALLOW_LIVE_ONBOARD=1`.
- Confirmation phrase: `ONBOARD_PROVIDER_APPLY`
- Live writes: **gated** (`PHASE_C_ALLOW_LIVE_ONBOARD=1` + scoped GO + approved adapters)
- da-DK apply GO is blocked until official CLI live dryRun PASS is archived.

Write surface (apply mode only):

1. provider create (approved path)
2. organizations mirror
3. provider_settings
4. provider_admin auth
5. membership
6. `syncProviderToSanity` + read-only verify

Never: menuDays · publish · SOT · auto-rollout · order path · Melhus/Swedish mutation.

Rollback / deactivation plan is always emitted by the planner (membership deactivate → admin deactivate → provider status PAUSED/SUSPENDED → retain org/mirror history).

---

## 4. Safety gates

| Gate | Rule |
|------|------|
| Factory dryRun | Zero writes |
| Factory apply | Confirmation phrase required |
| Live factory writes | Separate scoped GO only |
| `syncProviderToSanity` | Mandatory before first generator apply |
| Generator dryRun | `safeToApply=true` / `applyBlocked=false` / `providerMirrorPreflight.ok=true` |
| Generator apply | Separate scoped GO (one provider · one far-future week) |
| PR #430 preflight | Always enforced in apply path |
| SOT | **NO-GO** |
| Auto-rollout | **NO-GO** |

---

## 5. Launch readiness decision

| Decision | State |
|----------|-------|
| Melhus / Swedish control smoke | PASS |
| Remaining 7 locales | **BLOCKED_PROVIDER** until onboarding GO |
| SOT | **NO-GO** |
| Auto-rollout | **NO-GO** |
| Ready for uncontrolled multi-country apply | **NO** |

### Known risk

`syncProviderToSanity` is still **manual (intentional in generator apply)**. Phase C factory makes mirror sync a mandatory onboarding write step under scoped GO, reducing ad-hoc risk.

---

## 6. Exact next scoped GO prompt (da-DK)

**Prerequisite:** official CLI live dryRun PASS archived (this control fix). Apply GO remains separate.

```text
GO Phase C da-DK provider onboarding apply-only — Danish Lunch Pilot (slug=danish-lunch-pilot, locale=da-DK, menuProfileId=danish_office_lunch, country=DK, currency=DKK, timezone=Europe/Copenhagen, adminEmail=danish-lunch-pilot-admin@lunchportalen.no, confirm=ONBOARD_PROVIDER_APPLY). Allowed: provider/org/settings/auth/membership + syncProviderToSanity + read-only verify. Forbidden: menuDays, publish, generator apply, SOT, mass expansion, Melhus/Swedish mutation.
```

After onboarding PASS: generator dryRun only → evidence archive → separate GO for menu apply.

---

## 7. STOP

Do not start SOT.  
Do not start auto-rollout.  
Do not run production menu apply without explicit scoped GO.  
Do not run production mutations without explicit scoped GO.
