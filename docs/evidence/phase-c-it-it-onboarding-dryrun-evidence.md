# Phase C — it-IT provider onboarding dryRun evidence

## 1. Scope

- Phase C it-IT provider onboarding dryRun-only
- Provider: Italian Lunch Pilot
- Slug: `italian-lunch-pilot`
- Locale: `it-IT`
- Menu profile: `italian_office_lunch`
- Country/currency: IT / EUR
- Timezone: Europe/Rome
- Admin email: `italian-lunch-pilot-admin@lunchportalen.no`
- Safe future week: `2031-12-15`
- Rollout order: 7
- No onboarding apply
- No generator apply
- No provider creation
- No Sanity mutation
- No menuDays
- No publish
- No SOT
- No auto-rollout

## 2. Source Resolution

- Target resolved from:
  - `lib/provider-onboarding/phaseCLocales.ts`
  - `lib/menu-profile/registry.ts`
  - `lib/menu-profile/marketDefaults.ts`
  - `lib/provider-onboarding/phaseCOnboardCli.ts`
- Source-authoritative menu profile:
  - `italian_office_lunch`
- Note:
  - Do not guess or rename the Italian profile.
  - Use `italian_office_lunch` for all future it-IT steps unless source changes.
- Expected inventory before onboarding:
  - BLOCKED_PROVIDER

## 3. Production Baseline

- liveReadEnv:
  - Production Supabase + production Sanity aligned
- Provider count before:
  - 8
- Orders before:
  - 17
- nb-NO:
  - READY_FOR_SCOPED_APPLY
- sv-SE:
  - READY_FOR_SCOPED_APPLY
- da-DK:
  - READY_FOR_DRYRUN
- fi-FI:
  - READY_FOR_DRYRUN
- en-GB:
  - READY_FOR_DRYRUN
- de-DE:
  - READY_FOR_DRYRUN
- fr-FR:
  - READY_FOR_DRYRUN
- es-ES:
  - READY_FOR_DRYRUN
- it-IT:
  - BLOCKED_PROVIDER
- Slug conflict:
  - none
- Email conflict:
  - none
- Sanity mirror conflict:
  - none
- it-IT menuDays:
  - 0
- it-IT catalog docs:
  - 0

## 4. Official DryRun

- CLI:
  - `phase-c-onboard-provider.mjs --dry-run --snapshot-source live --env-file .env.preview.verify --locale it-IT`
- Exit:
  - 0
- Mode:
  - dry_run
- Status:
  - DRY_RUN_OK
- Snapshot source:
  - live
- Validation:
  - ok=true
  - blockers=[]
- Would create provider:
  - yes
- Would create org mirror:
  - yes
- Would create settings:
  - yes
- Would create auth user:
  - yes
- Would create membership:
  - yes
- Would create Sanity mirror:
  - yes
- Write plan:
  - present
- Rollback plan:
  - present
- Writes:
  - 0
- liveWrites:
  - false
- Password printed:
  - false
- Secrets redacted:
  - true

## 5. Post-DryRun Read-Back

- Provider count:
  - 8 → 8
- Orders:
  - 17 → 17
- it-IT provider created:
  - no
- it-IT Sanity mirror:
  - no
- it-IT menuDays/catalog:
  - 0 / 0
- Melhus:
  - untouched
  - 226 menuDays
- Swedish Lunch Pilot:
  - untouched
  - 15 menuDays
- Danish Lunch Pilot:
  - untouched
  - 15 menuDays
- Finnish Lunch Pilot:
  - untouched
  - 15 menuDays
- UK Lunch Pilot:
  - untouched
  - 15 menuDays
- German Lunch Pilot:
  - untouched
  - 15 menuDays
- French Lunch Pilot:
  - untouched
  - 15 menuDays
- Spanish Lunch Pilot:
  - untouched
  - 15 menuDays
- SOT:
  - not started
- Auto-rollout:
  - not started

## 6. Gates

- lint:
  - PASS
  - existing design-token warnings only
- commercial-hardcodes-guard:
  - PASS

## 7. Safety

- Onboarding apply:
  - not run
- Generator apply:
  - not run
- Provider mutation:
  - none
- Sanity mutation:
  - none
- MenuDays:
  - none
- Publish:
  - not run
- Order write-path:
  - untouched
- lp_order_set:
  - untouched
- DB/RLS:
  - no migration
- Production flags:
  - unchanged
- SOT:
  - not started
- Auto-rollout:
  - not started
- Batch apply:
  - not run
- Publish-as-apply:
  - not run

## 8. Known Risk

- it-IT onboarding apply remains gated by:
  - `ONBOARD_PROVIDER_APPLY`
  - `PHASE_C_ALLOW_LIVE_ONBOARD=1`
  - `confirm=ONBOARD_PROVIDER_APPLY`
- Menu profile is `italian_office_lunch` and must remain source-authoritative.
- No menu/generator apply before post-onboard generator dryRun PASS.
- it-IT is ready for onboarding apply only after evidence archive and separate scoped GO.
- SOT remains NO-GO.
- Auto-rollout remains NO-GO.

## 9. Next Action

- Archive this evidence first.
- Then run it-IT onboarding apply-only under explicit separate GO:
  - provider=Italian Lunch Pilot
  - slug=italian-lunch-pilot
  - locale=it-IT
  - menuProfileId=italian_office_lunch
  - country=IT
  - currency=EUR
  - timezone=Europe/Rome
  - adminEmail=italian-lunch-pilot-admin@lunchportalen.no
  - confirm=ONBOARD_PROVIDER_APPLY
- Do not start SOT.
- Do not auto-rollout.
- Do not run generator apply yet.
