# Phase C en-GB Provider Onboarding dryRun — Evidence

Docs-only evidence archive. No production mutation. No provider creation. No generator apply. No SOT. No auto-rollout.

Main HEAD at capture: `f407f41f` — docs(menu): archive Phase C fi-FI generator apply evidence (#439)

## 1. Scope

- Phase C en-GB provider onboarding dryRun-only
- Provider: UK Lunch Pilot
- Slug: `uk-lunch-pilot`
- Locale: `en-GB`
- Menu profile: `uk_office_lunch`
- Country / currency: GB / GBP
- Timezone: Europe/London
- Admin email: `uk-lunch-pilot-admin@lunchportalen.no`
- Safe future week: 2031-11-17
- Rollout order: 3
- No onboarding apply
- No generator apply
- No provider creation
- No Sanity mutation
- No menuDays
- No publish
- No SOT
- No auto-rollout

## 2. Source resolution

Target resolved from repository source only:

- `lib/provider-onboarding/phaseCLocales.ts` (locale target + `PHASE_C_SAFE_FUTURE_WEEKS`)
- `lib/menu-profile/registry.ts` (menu profile `uk_office_lunch`)
- `lib/provider-onboarding/phaseCOnboardCli.ts` (CLI defaults, admin email pattern)

Expected inventory before onboarding: `BLOCKED_PROVIDER`

## 3. Production baseline

- liveReadEnv: production Supabase + production Sanity aligned
- Provider count before: 4
- Orders before: 17
- nb-NO: READY_FOR_SCOPED_APPLY
- sv-SE: READY_FOR_SCOPED_APPLY
- da-DK: READY_FOR_DRYRUN
- fi-FI: READY_FOR_DRYRUN
- en-GB: BLOCKED_PROVIDER — provider not present
- Slug conflict: none
- Email conflict: none
- Sanity mirror conflict: none
- en-GB menuDays: 0
- en-GB catalog docs: 0

## 4. Official dryRun

- CLI: `node scripts/ops/provider-onboarding/phase-c-onboard-provider.mjs --dry-run --snapshot-source live --locale en-GB`
- Exit: 0
- Mode: dry_run
- Status: DRY_RUN_OK
- Snapshot source: live
- Validation: ok=true, blockers=[]
- Would create provider: yes
- Would create org mirror: yes
- Would create settings: yes
- Would create auth user: yes
- Would create membership: yes
- Would create Sanity mirror: yes
- Write plan: present, 7 steps
- Rollback plan: present, 5 steps
- Writes: 0
- liveWrites: false
- Password printed: false
- Secrets redacted: true
- globalTemplates: PASS
- safeToOnboardApply: false (expected — apply requires separate scoped GO)

## 5. Post-dryRun read-back

- Provider count: 4 → 4
- Orders: 17 → 17
- en-GB provider created: no
- en-GB Sanity mirror: no
- en-GB menuDays / catalog: 0 / 0
- Melhus: untouched
- Swedish Lunch Pilot: untouched
- Danish Lunch Pilot: untouched
- Finnish Lunch Pilot: untouched
- SOT: not started
- Auto-rollout: not started

## 6. Gates

- lint: PASS
- commercial-hardcodes-guard: PASS

## 7. Safety

- Onboarding apply: not run
- Generator apply: not run
- Provider mutation: none
- Sanity mutation: none
- MenuDays: none
- Publish: not run
- Order write-path: untouched
- `lp_order_set`: untouched
- DB/RLS: untouched
- Production flags: unchanged
- SOT: not started
- Auto-rollout: not started
- Batch apply: not run
- Publish-as-apply: not run

## 8. Known risk

- en-GB onboarding apply remains gated by:
  - `ONBOARD_PROVIDER_APPLY`
  - `PHASE_C_ALLOW_LIVE_ONBOARD=1`
  - `confirm=ONBOARD_PROVIDER_APPLY`
- No menu/generator apply before post-onboard generator dryRun PASS
- en-GB is ready for onboarding apply only with separate scoped GO
- SOT remains NO-GO
- Auto-rollout remains NO-GO

## 9. Next action

- Archive this evidence first
- Then run en-GB onboarding apply-only under explicit separate GO
- Do not start SOT
- Do not auto-rollout
- Do not run generator apply yet
