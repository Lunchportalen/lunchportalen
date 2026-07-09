# Phase C — es-ES provider onboarding dryRun evidence

## 1. Scope

- Phase C es-ES provider onboarding dryRun-only
- Provider: Spanish Lunch Pilot
- Slug: `spanish-lunch-pilot`
- Locale: `es-ES`
- Menu profile: `spanish_menu_del_dia`
- Country/currency: ES / EUR
- Timezone: Europe/Madrid
- Admin email: `spanish-lunch-pilot-admin@lunchportalen.no`
- Safe future week: `2031-12-08`
- Rollout order: 6
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
  - `spanish_menu_del_dia`
- Note:
  - Do not guess or rename the Spanish profile.
  - Use `spanish_menu_del_dia` for all future es-ES steps unless source changes.
- Expected inventory before onboarding:
  - BLOCKED_PROVIDER

## 3. Production Baseline

- liveReadEnv:
  - Production Supabase + production Sanity aligned
- Provider count before:
  - 7
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
  - BLOCKED_PROVIDER
- it-IT:
  - BLOCKED_PROVIDER
- Slug conflict:
  - none
- Email conflict:
  - none
- Sanity mirror conflict:
  - none
- es-ES menuDays:
  - 0
- es-ES catalog docs:
  - 0

## 4. Official DryRun

- DryRun status:
  - PASS
- CLI:
  - `phase-c-onboard-provider.mjs --dry-run --snapshot-source live --env-file .env.preview.verify --locale es-ES`
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
  - 7 → 7
- Orders:
  - 17 → 17
- es-ES provider created:
  - no
- es-ES Sanity mirror:
  - no
- es-ES menuDays/catalog:
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

- es-ES onboarding apply remains gated by:
  - `ONBOARD_PROVIDER_APPLY`
  - `PHASE_C_ALLOW_LIVE_ONBOARD=1`
  - `confirm=ONBOARD_PROVIDER_APPLY`
- Menu profile is `spanish_menu_del_dia` and must remain source-authoritative.
- No menu/generator apply before post-onboard generator dryRun PASS.
- es-ES is ready for onboarding apply only after evidence archive and separate scoped GO.
- SOT remains NO-GO.
- Auto-rollout remains NO-GO.

## 9. Next Action

- Archive this evidence first.
- Then run es-ES onboarding apply-only under explicit separate GO:
  - provider=Spanish Lunch Pilot
  - slug=spanish-lunch-pilot
  - locale=es-ES
  - menuProfileId=spanish_menu_del_dia
  - country=ES
  - currency=EUR
  - timezone=Europe/Madrid
  - adminEmail=spanish-lunch-pilot-admin@lunchportalen.no
  - confirm=ONBOARD_PROVIDER_APPLY
- Do not start SOT.
- Do not auto-rollout.
- Do not run generator apply yet.
