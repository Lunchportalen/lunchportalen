# Phase C — fr-FR generator apply evidence

## 1. Scope

- Phase C fr-FR generator apply-only
- Provider: French Lunch Pilot
- ProviderId: `c482495c-d209-4f21-a5de-e1daf5318f90`
- Slug: `french-lunch-pilot`
- Locale/profile: `fr-FR` / `french_dejeuner`
- Week: `2031-12-01 → 2031-12-05`
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
  - `07e4c06d`
- liveReadEnv:
  - Production Supabase + production Sanity aligned
- Provider readiness:
  - ACTIVE
  - org mirror OK
  - settings OK: fr-FR / french_dejeuner / FR / EUR / Europe/Paris
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
  - es-ES / it-IT BLOCKED_PROVIDER
- Provider count before:
  - 7
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

## 3. Pre-Apply DryRun

- RID:
  - `prov_mapply_mrb9ju49_t1v4h8clwkvellqc`
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

## 4. Apply

- Apply status:
  - PASS — CLASS B
- RID:
  - `prov_mapply_mrb9kz3a_zj5162r1ofqwnr1b`
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
  - 5 weekdays x BASIS / ENTERPRISE / LUXUS
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
  - `c482495c-d209-4f21-a5de-e1daf5318f90`
  - all match
- Locale/profile:
  - fr-FR / french_dejeuner
- French content:
  - Steak frites
  - Blanquette de veau
  - Quiche lorraine
  - Soupe à l'oignon
  - Boeuf bourguignon
- French labels/catalog items:
  - Gratin de légumes
  - Risotto aux champignons
  - Tarte aux légumes
- Allergens:
  - present on menuDays/catalog items
  - systemic allergen tokens include Melk, Gluten, Egg, hvete
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
- Global templates:
  - unchanged

## 6. Post-Apply DryRun

- Idempotency:
  - PASS
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
- No French provider leak into unrelated employee surface
- No price/currency/VAT/commission/invoice/margin/cost leak
- No approved_by/approved_at/translated_text/original_text_hash leak

## 8. Safety

- Orders:
  - 17 → 17
- Provider count:
  - 7 → 7 after generator apply
- Order write-path:
  - untouched
- lp_order_set:
  - untouched
- DB/RLS:
  - unchanged
- Production flags:
  - unchanged
- Production Sanity changed only by:
  - 15 fr-FR target-week draft menuDays
  - 1 fr-FR provider-scoped category doc
- MenuDays:
  - only expected fr-FR target-week drafts
- Catalog docs:
  - only expected fr-FR provider-scoped doc
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
- Rollback:
  - not needed
  - not performed

## 9. Known Risk

- No customer-facing content risk observed.
- Internal/system labels are operator-facing/systemic and consistent with prior locales:
  - `varmrett`
  - `Vegetar`
  - allergen tokens
- Customer-facing content is French.
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
- Next pending locale should be es-ES if source rollout order confirms it.
- Do not start SOT.
- Do not auto-rollout.
- Do not run more generator applies without separate GO.
