# Phase C — fr-FR provider onboarding apply evidence

## 1. Scope

- Phase C fr-FR provider onboarding apply-only
- Provider: French Lunch Pilot
- ProviderId: `c482495c-d209-4f21-a5de-e1daf5318f90`
- Slug: `french-lunch-pilot`
- Locale/profile: `fr-FR` / `french_dejeuner`
- Country/currency: FR / EUR
- Timezone: Europe/Paris
- Admin email: `french-lunch-pilot-admin@lunchportalen.no`
- Safe future week: `2031-12-01`
- No generator apply
- No menu apply
- No menuDays
- No catalog docs
- No publish
- No SOT
- No auto-rollout
- No batch apply
- No publish-as-apply

## 2. Source Resolution

- Target resolved from:
  - `lib/provider-onboarding/phaseCLocales.ts`
  - `lib/menu-profile/registry.ts`
  - `lib/menu-profile/marketDefaults.ts`
  - `lib/provider-onboarding/phaseCOnboardCli.ts`
- Source target matched PR #446 dryRun evidence:
  - providerName=French Lunch Pilot
  - slug=french-lunch-pilot
  - locale=fr-FR
  - menuProfileId=french_dejeuner
  - countryCode=FR
  - currency=EUR
  - timezone=Europe/Paris
  - adminEmail=french-lunch-pilot-admin@lunchportalen.no
  - safeFutureWeek=2031-12-01
- Critical:
  - `french_dejeuner` is source-authoritative
  - `french_business_lunch` must not be used

## 3. Pre-Apply Baseline

- Main HEAD at execution:
  - `f843c26c`
- liveReadEnv:
  - Production Supabase + production Sanity aligned
- Provider count before:
  - 6
- Orders before:
  - 17
- Inventory:
  - nb-NO READY_FOR_SCOPED_APPLY
  - sv-SE READY_FOR_SCOPED_APPLY
  - da-DK READY_FOR_DRYRUN
  - fi-FI READY_FOR_DRYRUN
  - en-GB READY_FOR_DRYRUN
  - de-DE READY_FOR_DRYRUN
  - fr-FR BLOCKED_PROVIDER
  - es-ES BLOCKED_PROVIDER
  - it-IT BLOCKED_PROVIDER
- Slug conflict:
  - none
- Email conflict:
  - none
- Sanity mirror conflict:
  - none
- fr-FR menuDays:
  - 0
- fr-FR catalog docs:
  - 0

## 4. Pre-Apply DryRun

- CLI:
  - official onboarding dryRun with `--snapshot-source live --env-file .env.preview.verify --locale fr-FR`
- Exit:
  - 0
- Mode:
  - dry_run
- Snapshot source:
  - live
- Validation:
  - ok=true
  - blockers=[]
- Menu profile:
  - `french_dejeuner`
- Would create:
  - provider row
  - organization mirror
  - provider_settings
  - provider_admin auth user
  - provider_membership
  - Sanity provider mirror
- Writes:
  - 0
- liveWrites:
  - false
- Password printed:
  - false
- Secrets redacted:
  - true
- Matched PR #446 dryRun evidence:
  - yes

## 5. Apply

- Apply status:
  - PASS — CLASS B
- CLI:
  - official onboarding apply, exactly once
- Exit:
  - 0
- Mode:
  - apply
- Confirm:
  - ONBOARD_PROVIDER_APPLY
- Created provider row:
  - yes
- ProviderId:
  - `c482495c-d209-4f21-a5de-e1daf5318f90`
- Created organization mirror:
  - yes
- Created provider_settings:
  - yes
- Created auth user:
  - yes
- Created membership:
  - yes, provider_admin
- Created Sanity mirror:
  - yes, syncProviderToSanity
- Password printed:
  - false
- Secrets redacted:
  - true
- MenuDays created:
  - 0
- Catalog docs created:
  - 0
- Published docs changed:
  - 0
- Generator apply:
  - not run
- SOT:
  - not started
- Auto-rollout:
  - not started

## 6. Post-Apply Read-Back

- Provider row:
  - ACTIVE
  - slug/name match
- Organization mirror:
  - present
- Settings:
  - locale=fr-FR
  - menu_profile_id=french_dejeuner
  - country=FR
  - currency=EUR
  - timezone=Europe/Paris
- Auth:
  - provider_admin present
- Membership:
  - provider_admin present
- Sanity mirror:
  - present
  - slug match
- providerRef:
  - resolves
- providerMirrorPreflight:
  - ok=true
- Provider count:
  - 6 -> 7
- Orders:
  - 17 -> 17
- fr-FR menuDays:
  - 0
- fr-FR catalog docs:
  - 0
- Protected providers:
  - Melhus untouched, 226 menuDays
  - Swedish Lunch Pilot untouched, 15 menuDays
  - Danish Lunch Pilot untouched, 15 menuDays
  - Finnish Lunch Pilot untouched, 15 menuDays
  - UK Lunch Pilot untouched, 15 menuDays
  - German Lunch Pilot untouched, 15 menuDays
- SOT:
  - not started
- Auto-rollout:
  - not started

## 7. Post-Onboard Inventory

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
- Remaining:
  - es-ES BLOCKED_PROVIDER
  - it-IT BLOCKED_PROVIDER

## 8. Generator DryRun-Only

- Generator apply:
  - not run
- Week:
  - `2031-12-01`
- RID:
  - `prov_mapply_mrb6psc6_ezkil753wwc3b9dm`
- HTTP:
  - 200
- ok:
  - true
- providerMirrorPreflight:
  - ok=true
  - safeToApply=true
  - applyBlocked=false
- locale:
  - fr-FR
- menuProfileId:
  - `french_dejeuner`
- unsupportedCategories:
  - 0
- mutation performed:
  - false
- appliedDates:
  - []
- appliedCatalogCategories:
  - []
- French labels/content:
  - Sandwichs
  - Salades
  - Plats chauds
  - Sushi
  - Poké bowls
  - Asiatique
  - Végétarien
- Content examples:
  - Croque-monsieur
  - Salade quinoa
  - Steak frites
  - Blanquette de veau
- Norwegian fallback:
  - none in customer titles
  - internal/operator `varmrett` warning only
- forbiddenHits:
  - none
- Employee economy exposure:
  - none
- Employee metadata exposure:
  - none

## 9. Safety

- Order count:
  - 17 -> 17
- Order write-path:
  - untouched
- lp_order_set:
  - untouched
- DB/RLS:
  - unchanged
- Production flags:
  - unchanged
- Production Sanity changed only by:
  - fr-FR provider mirror
- MenuDays:
  - none
- Catalog docs:
  - none
- Publish:
  - not run
- SOT:
  - not started
- Auto-rollout:
  - not started
- Batch apply:
  - not run
- Publish-as-apply:
  - not run
- Apply flags unset after run:
  - yes
- Rollback:
  - not needed
  - not performed

## 10. Known Risk

- fr-FR is READY_FOR_DRYRUN, not generator-applied.
- Generator apply still requires separate scoped GO.
- Menu profile is `french_dejeuner`, not `french_business_lunch`.
- No generator apply before separate scoped GO.
- SOT remains NO-GO.
- Auto-rollout remains NO-GO.

## 11. Next Action

- Archive this evidence first.
- Then separate scoped GO for fr-FR generator apply-only:
  - providerId=c482495c-d209-4f21-a5de-e1daf5318f90
  - weekStart=2031-12-01
  - categoryScope=all_supported
  - overwriteMode=create_missing_only_strict
  - menuProfileId=french_dejeuner
- Do not start SOT.
- Do not auto-rollout.
