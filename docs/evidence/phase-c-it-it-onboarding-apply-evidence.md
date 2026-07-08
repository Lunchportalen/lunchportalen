# Phase C — it-IT provider onboarding apply evidence

## 1. Scope

- Phase C it-IT provider onboarding apply-only
- Provider: Italian Lunch Pilot
- ProviderId: `50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa`
- Slug: `italian-lunch-pilot`
- Locale/profile: `it-IT` / `italian_office_lunch`
- Country/currency: IT / EUR
- Timezone: Europe/Rome
- Admin email: `italian-lunch-pilot-admin@lunchportalen.no`
- Safe future week: `2031-12-15`
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
- Source target matched PR #452 dryRun evidence:
  - providerName=Italian Lunch Pilot
  - slug=italian-lunch-pilot
  - locale=it-IT
  - menuProfileId=italian_office_lunch
  - countryCode=IT
  - currency=EUR
  - timezone=Europe/Rome
  - adminEmail=italian-lunch-pilot-admin@lunchportalen.no
  - safeFutureWeek=2031-12-15
- Critical:
  - `italian_office_lunch` is source-authoritative
  - do not guess or rename it

## 3. Pre-Apply Baseline

- Main HEAD at execution:
  - `c86ee63b`
- liveReadEnv:
  - Production Supabase + production Sanity aligned
- Provider count before:
  - 8
- Orders before:
  - 17
- Inventory:
  - nb-NO READY_FOR_SCOPED_APPLY
  - sv-SE READY_FOR_SCOPED_APPLY
  - da-DK READY_FOR_DRYRUN
  - fi-FI READY_FOR_DRYRUN
  - en-GB READY_FOR_DRYRUN
  - de-DE READY_FOR_DRYRUN
  - fr-FR READY_FOR_DRYRUN
  - es-ES READY_FOR_DRYRUN
  - it-IT BLOCKED_PROVIDER
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

## 4. Pre-Apply DryRun

- CLI:
  - official onboarding dryRun with `--snapshot-source live --env-file .env.preview.verify --locale it-IT`
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
  - `italian_office_lunch`
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
- Matched PR #452 dryRun evidence:
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
  - `50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa`
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
  - locale=it-IT
  - menu_profile_id=italian_office_lunch
  - country=IT
  - currency=EUR
  - timezone=Europe/Rome
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
  - 8 → 9
- Orders:
  - 17 → 17
- it-IT menuDays:
  - 0
- it-IT catalog docs:
  - 0
- Protected providers:
  - Melhus untouched, 226 menuDays
  - Swedish Lunch Pilot untouched, 15 menuDays
  - Danish Lunch Pilot untouched, 15 menuDays
  - Finnish Lunch Pilot untouched, 15 menuDays
  - UK Lunch Pilot untouched, 15 menuDays
  - German Lunch Pilot untouched, 15 menuDays
  - French Lunch Pilot untouched, 15 menuDays
  - Spanish Lunch Pilot untouched, 15 menuDays
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
- es-ES:
  - READY_FOR_DRYRUN
- it-IT:
  - READY_FOR_DRYRUN

## 8. Generator DryRun-Only

- Generator apply:
  - not run
- Week:
  - `2031-12-15`
- RID:
  - `prov_mapply_mrc0t318_rct2vu1ptce4y66h`
- HTTP:
  - 200
- ok:
  - true
- providerMirrorPreflight:
  - ok=true
  - safeToApply=true
  - applyBlocked=false
- locale:
  - it-IT
- menuProfileId:
  - `italian_office_lunch`
- unsupportedCategories:
  - 0
- mutation performed:
  - false
- post-readback:
  - it-IT menuDays/catalog docs 0 / 0
- Italian labels/content:
  - Panini
  - Insalate
  - Piatti caldi
  - Sushi
  - Poké bowl
  - Asiatico
  - Vegetariano
- Content examples:
  - Piadina prosciutto
  - Insalata tonno
  - Penne all'arrabbiata
  - Minestrone
- Norwegian fallback:
  - none in customer titles
  - internal/operator `varmrett` warning only
- forbiddenHits:
  - none
- Employee economy exposure:
  - none by dryRun payload scan
- Employee metadata exposure:
  - none by dryRun payload scan

## 9. Safety

- Order count:
  - 17 → 17
- Order write-path:
  - untouched
- lp_order_set:
  - untouched
- DB/RLS:
  - unchanged
- Production flags:
  - unchanged
- Production Sanity changed only by:
  - it-IT provider mirror
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

- it-IT is READY_FOR_DRYRUN, not generator-applied.
- Generator apply still requires separate scoped GO.
- Menu profile is `italian_office_lunch` and must remain source-authoritative.
- No generator apply before separate scoped GO.
- SOT remains NO-GO.
- Auto-rollout remains NO-GO.

## 11. Next Action

- Archive this evidence first.
- Then separate scoped GO for it-IT generator apply-only:
  - providerId=50eb1ebc-d1a9-4f6e-9737-a0415fddeaaa
  - weekStart=2031-12-15
  - categoryScope=all_supported
  - overwriteMode=create_missing_only_strict
  - menuProfileId=italian_office_lunch
- Do not start SOT.
- Do not auto-rollout.
