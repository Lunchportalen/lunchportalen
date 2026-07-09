# Phase C — es-ES provider onboarding apply evidence

## 1. Scope

- Phase C es-ES provider onboarding apply-only
- Provider: Spanish Lunch Pilot
- ProviderId: `97e5b254-8f6f-4d0d-9c12-3596c14392ac`
- Slug: `spanish-lunch-pilot`
- Locale/profile: `es-ES` / `spanish_menu_del_dia`
- Country/currency: ES / EUR
- Timezone: Europe/Madrid
- Admin email: `spanish-lunch-pilot-admin@lunchportalen.no`
- Safe future week: `2031-12-08`
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
- Source target matched PR #449 dryRun evidence:
  - providerName=Spanish Lunch Pilot
  - slug=spanish-lunch-pilot
  - locale=es-ES
  - menuProfileId=spanish_menu_del_dia
  - countryCode=ES
  - currency=EUR
  - timezone=Europe/Madrid
  - adminEmail=spanish-lunch-pilot-admin@lunchportalen.no
  - safeFutureWeek=2031-12-08
- Critical:
  - `spanish_menu_del_dia` is source-authoritative
  - do not guess or rename it

## 3. Pre-Apply Baseline

- Main HEAD at execution:
  - `bea2d2e9`
- liveReadEnv:
  - Production Supabase + production Sanity aligned
- Provider count before:
  - 7
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
  - es-ES BLOCKED_PROVIDER
  - it-IT BLOCKED_PROVIDER
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

## 4. Pre-Apply DryRun

- CLI:
  - official onboarding dryRun with `--snapshot-source live --env-file .env.preview.verify --locale es-ES`
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
  - `spanish_menu_del_dia`
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
- Matched PR #449 dryRun evidence:
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
  - `97e5b254-8f6f-4d0d-9c12-3596c14392ac`
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
  - locale=es-ES
  - menu_profile_id=spanish_menu_del_dia
  - country=ES
  - currency=EUR
  - timezone=Europe/Madrid
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
  - 7 → 8
- Orders:
  - 17 → 17
- es-ES menuDays:
  - 0
- es-ES catalog docs:
  - 0
- Protected providers:
  - Melhus untouched, 226 menuDays
  - Swedish Lunch Pilot untouched, 15 menuDays
  - Danish Lunch Pilot untouched, 15 menuDays
  - Finnish Lunch Pilot untouched, 15 menuDays
  - UK Lunch Pilot untouched, 15 menuDays
  - German Lunch Pilot untouched, 15 menuDays
  - French Lunch Pilot untouched, 15 menuDays
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
- Remaining:
  - it-IT BLOCKED_PROVIDER

## 8. Generator DryRun-Only

- Generator apply:
  - not run
- Week:
  - `2031-12-08`
- RID:
  - `prov_mapply_mrbdt17u_qu0hfjjw98iaapi7`
- HTTP:
  - 200
- ok:
  - true
- providerMirrorPreflight:
  - ok=true
  - safeToApply=true
  - applyBlocked=false
- locale:
  - es-ES
- menuProfileId:
  - `spanish_menu_del_dia`
- unsupportedCategories:
  - 0
- mutation performed:
  - false
- post-readback:
  - es-ES menuDays/catalog docs 0 / 0
- Spanish labels/content:
  - Bocadillos
  - Ensaladas
  - Platos calientes
  - Sushi
  - Poké bowls
  - Asiático
  - Vegetariano
- Content examples:
  - Bocadillo de lomo
  - Ensalada verde
  - Paella de verduras
  - Pollo al ajillo
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
  - es-ES provider mirror
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

- es-ES is READY_FOR_DRYRUN, not generator-applied.
- Generator apply still requires separate scoped GO.
- Menu profile is `spanish_menu_del_dia` and must remain source-authoritative.
- No generator apply before separate scoped GO.
- SOT remains NO-GO.
- Auto-rollout remains NO-GO.

## 11. Next Action

- Archive this evidence first.
- Then separate scoped GO for es-ES generator apply-only:
  - providerId=97e5b254-8f6f-4d0d-9c12-3596c14392ac
  - weekStart=2031-12-08
  - categoryScope=all_supported
  - overwriteMode=create_missing_only_strict
  - menuProfileId=spanish_menu_del_dia
- Do not start SOT.
- Do not auto-rollout.
