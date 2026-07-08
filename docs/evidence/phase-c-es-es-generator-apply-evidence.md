# Phase C — es-ES generator apply evidence

## 1. Scope

- Phase C es-ES generator apply-only
- Provider: Spanish Lunch Pilot
- ProviderId: `97e5b254-8f6f-4d0d-9c12-3596c14392ac`
- Slug: `spanish-lunch-pilot`
- Locale/profile: `es-ES` / `spanish_menu_del_dia`
- Week: `2031-12-08 → 2031-12-12`
- Far-future week
- Single provider
- Single scoped apply
- `categoryScope=all_supported`
- `overwriteMode=create_missing_only_strict`
- No publish
- No SOT
- No auto-rollout
- No batch apply
- No publish-as-apply
- No onboarding apply

## 2. Preflight

- Main HEAD:
  - `0c5b27c3`
- liveReadEnv:
  - Production Supabase + production Sanity aligned
- Provider readiness:
  - ACTIVE
  - org mirror OK
  - settings OK: es-ES / spanish_menu_del_dia / ES / EUR / Europe/Madrid
  - admin auth OK
  - provider_admin membership OK
  - Sanity mirror OK
  - providerRef resolves
  - providerMirrorPreflight.ok=true
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
- Provider count before:
  - 8
- Orders before:
  - 17
- Target week before:
  - 0 menuDays
- Catalog snapshot before:
  - 0 provider-scoped docs
- Global templates:
  - 7 docs
  - revHash 320
- Protected providers:
  - Melhus 226 menuDays unchanged
  - Swedish Lunch Pilot 15 menuDays unchanged
  - Danish Lunch Pilot 15 menuDays unchanged
  - Finnish Lunch Pilot 15 menuDays unchanged
  - UK Lunch Pilot 15 menuDays unchanged
  - German Lunch Pilot 15 menuDays unchanged
  - French Lunch Pilot 15 menuDays unchanged

## 3. Pre-Apply DryRun

- RID:
  - `prov_mapply_mrbs4fnl_p3iy377nmm7zfbnw`
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
  - 0 menuDays/catalog docs
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
  - none
- Employee metadata exposure:
  - none

## 4. Apply

- Apply status:
  - PASS — CLASS B
- RID:
  - `prov_mapply_mrbs5d4h_eulnhw8y3wc9ci8p`
- HTTP:
  - 200
- ok:
  - true
- mode:
  - apply
- Applied exactly once:
  - yes
- Retry:
  - no
- Created menuDay drafts:
  - 15
  - 5 weekdays × BASIS / ENTERPRISE / LUXUS
- Created provider catalog docs:
  - 1
  - provider-scoped category doc
- Updated catalog docs:
  - 0
- Published docs changed:
  - 0
- Extra docs created:
  - none beyond expected target-week drafts + provider catalog doc
- Publish:
  - not run
- SOT:
  - not started
- Auto-rollout:
  - not started

## 5. Read-Back

- Unique weekdays:
  - 5
- Tier structure:
  - BASIS
  - ENTERPRISE
  - LUXUS
- Draft status:
  - all unpublished operational drafts
  - approvedForPublish=false
  - customerVisible=false
- providerRef:
  - `97e5b254-8f6f-4d0d-9c12-3596c14392ac`
  - all match
- Locale/profile:
  - es-ES / spanish_menu_del_dia
- Spanish content:
  - Paella de verduras
  - Pollo al ajillo
  - Carrillada estofada
  - Albóndigas con patatas
  - Macarrones con tomate
- Spanish labels/catalog items:
  - Risotto de setas
  - Tortilla de verduras
  - Lentejas veganas
  - Ensalada completa
- Allergens:
  - present on menuDays/catalog items
  - systemic allergen tokens include Gluten, Melk, Egg, hvete
- Norwegian fallback:
  - none in customer-facing provider menu surface
  - internal/operator labels only, systemic
- Melhus:
  - untouched
- Swedish Lunch Pilot:
  - untouched
- Danish Lunch Pilot:
  - untouched
- Finnish Lunch Pilot:
  - untouched
- UK Lunch Pilot:
  - untouched
- German Lunch Pilot:
  - untouched
- French Lunch Pilot:
  - untouched
- Global templates:
  - unchanged

## 6. Post-Apply DryRun

- createdDraftDays:
  - 0
- updatedDraftDays:
  - 0
- catalog updates:
  - 0
- unsupportedCategories:
  - 0
- duplicates:
  - none
- safeToApply:
  - true
- applyBlocked:
  - false
- mutation:
  - none

## 7. Employee/API

- `/api/week`:
  - 200
  - PASS
- `/api/order/window`:
  - 200
  - PASS
- Economy exposure:
  - none
- Metadata exposure:
  - none
- No Spanish provider leak into unrelated employee surface
- No price/currency/VAT/commission/invoice/margin/cost leak
- No approved_by/approved_at/translated_text/original_text_hash leak

## 8. Safety

- Orders:
  - 17 → 17
- Provider count:
  - 8 → 8 after generator apply
- Order write-path:
  - untouched
- lp_order_set:
  - untouched
- DB/RLS:
  - unchanged
- Production flags:
  - unchanged
- Production Sanity changed only by:
  - 15 es-ES target-week draft menuDays
  - 1 es-ES provider-scoped category doc
- MenuDays:
  - only expected es-ES target-week drafts
- Catalog docs:
  - only expected es-ES provider-scoped doc
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
- Protected providers:
  - no Melhus mutation
  - no Swedish mutation
  - no Danish mutation
  - no Finnish mutation
  - no UK mutation
  - no German mutation
  - no French mutation
- Rollback:
  - not needed
  - not performed

## 9. Known Risk

- No customer-facing content risk observed.
- Internal/system labels are operator-facing/systemic and consistent with prior locales:
  - `varmrett`
  - `Vegetar`
  - allergen tokens
- Customer-facing content is Spanish.
- Far-future unpublished drafts only.
- Customer-invisible.
- menuDay IDs are deterministic operational drafts, not published customer menu.
- Some allergens may live on catalog items rather than top-level menuDay docs.
- No further generator applies without separate scoped GO.
- SOT remains NO-GO.
- Auto-rollout remains NO-GO.

## 10. Next Action

- Archive this evidence first.
- Then proceed to next Phase C locale onboarding dryRun-only under separate scoped GO.
- Next pending locale should be it-IT if source rollout order confirms it.
- Do not start SOT.
- Do not auto-rollout.
- Do not run more generator applies without separate GO.
