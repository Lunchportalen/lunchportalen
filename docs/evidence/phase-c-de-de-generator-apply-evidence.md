# Phase C — de-DE generator apply-only evidence

## 1. Scope

- Phase C de-DE generator apply-only
- Provider: German Lunch Pilot
- ProviderId: `ae7a6495-9ded-4f76-98cf-050ea6385160`
- Slug: `german-lunch-pilot`
- Locale/profile: `de-DE` / `german_business_lunch`
- Week: `2031-11-24 → 2031-11-28`
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

> **CRITICAL:** `german_business_lunch` is source-authoritative. `german_office_lunch` does not exist and was not used.

## 2. Preflight

- Main HEAD: `9f853d5e`
- liveReadEnv: production Supabase + production Sanity aligned
- Provider readiness:
  - status ACTIVE
  - org mirror OK
  - settings OK: de-DE / german_business_lunch / DE / EUR / Europe/Berlin
  - admin auth OK
  - provider_admin membership OK
  - Sanity mirror OK (slug/id match)
  - providerMirrorPreflight.ok=true
- Inventory:
  - nb-NO READY_FOR_SCOPED_APPLY
  - sv-SE READY_FOR_SCOPED_APPLY
  - da-DK READY_FOR_DRYRUN
  - fi-FI READY_FOR_DRYRUN
  - en-GB READY_FOR_DRYRUN
  - de-DE READY_FOR_DRYRUN
  - fr-FR / es-ES / it-IT BLOCKED_PROVIDER
- Provider count before: 6
- Orders before: 17
- Target week before: 0 menuDays, 0 catalog docs
- Global templates: 7 docs, revHash 320
- Protected providers:
  - Melhus 226 menuDays unchanged
  - Swedish Lunch Pilot 15 menuDays unchanged
  - Danish Lunch Pilot 15 menuDays unchanged
  - Finnish Lunch Pilot 15 menuDays unchanged
  - UK Lunch Pilot 15 menuDays unchanged

## 3. Pre-apply dryRun

- RID: `prov_mapply_mrb1c56m_tqpn4jppnwbp26q8`
- HTTP: 200
- ok: true
- providerMirrorPreflight: ok=true
- safeToApply: true
- applyBlocked: false
- locale: de-DE
- menuProfileId: german_business_lunch
- unsupportedCategories: 0
- failedDays: 0
- mutation performed: false
- appliedDates: []
- German labels/content:
  - Belegte Brötchen
  - Salate
  - Warme Gerichte
  - Sushi
  - Poké Bowl
  - Asiatisch
  - Vegetarisch
- Content examples:
  - Hähnchen-Baguette
  - Rucola mit Burrata
  - Fischfilet mit Soße
  - Tofu-Curry
- Norwegian fallback:
  - none in customer-facing content
  - operator-facing warnings only, systemic
- forbiddenHits: []
- Employee economy exposure: none
- Employee metadata exposure: none

## 4. Apply

- Apply status: PASS — CLASS B
- RID: `prov_mapply_mrb1icb6_wmdjrvxv3vdxwv61`
- HTTP: 200
- ok: true
- mode: apply
- dryRun: false
- Applied exactly once: yes
- Retry: no
- Created menuDay drafts: 15 (5 dates × 3 tiers)
- appliedDates: 5
- Created provider catalog docs: 1 (lunchCategory provider-scoped vegetarian doc)
- Updated catalog docs: 0
- Published docs changed: 0
- Extra docs created: 0
- failedDays: 0
- Publish: not run
- SOT: not started
- Auto-rollout: not started

## 5. Read-back

- Unique weekdays: 5 (2031-11-24 → 2031-11-28)
- Tier structure: BASIS / ENTERPRISE / LUXUS
- Draft status:
  - all unpublished operational drafts
  - approvedForPublish=false
  - customerVisible=false
- providerRef: `ae7a6495-9ded-4f76-98cf-050ea6385160` (all match)
- Locale/profile: de-DE / german_business_lunch
- German content:
  - Fischfilet mit Soße
  - Schnitzel mit Kartoffelsalat
  - Hähnchencurry
  - Rindergulasch
- German labels (catalog items):
  - Tofu-Curry
  - Kartoffelgratin
  - Gemüselasagne
- Allergens:
  - present on catalog items
  - systemic allergen tokens: soya, melk, hvete, egg
- Norwegian fallback:
  - none in customer-facing provider menu surface
  - internal category key `varmrett` only, systemic
- Melhus: untouched
- Swedish Lunch Pilot: untouched
- Danish Lunch Pilot: untouched
- Finnish Lunch Pilot: untouched
- UK Lunch Pilot: untouched
- Global templates: revHash 320 unchanged

## 6. Post-apply dryRun (idempotency)

- createdDraftDays: 0
- updatedDraftDays: 0
- catalog updates: 0
- unsupportedCategories: 0
- failedDays: 0
- duplicates: none
- safeToApply: true
- applyBlocked: false
- mutation: none

## 7. Employee/API

- `/api/week`: 200 PASS
- `/api/order/window`: 200 PASS
- Economy exposure: none
- Metadata exposure: none
- No German provider leak into unrelated employee surface
- No price/currency/VAT/commission/invoice/margin/cost leak
- No approved_by/approved_at/translated_text/original_text_hash leak

## 8. Safety

- Orders: 17 → 17
- Provider count: 6 → 6 after generator apply
- Order write-path: untouched
- lp_order_set: untouched
- DB/RLS: unchanged
- Production flags: unchanged
- Production Sanity changed only by:
  - 15 de-DE target-week draft menuDays
  - 1 de-DE provider-scoped vegetarian catalog doc
- MenuDays: only expected de-DE target-week drafts
- Catalog docs: only expected de-DE provider-scoped vegetarian doc
- Publish: not run
- SOT: not started
- Auto-rollout: not started
- Batch apply: not run
- Publish-as-apply: not run
- Protected providers:
  - no Melhus mutation
  - no Swedish mutation
  - no Danish mutation
  - no Finnish mutation
  - no UK mutation
- Rollback: not needed, not performed

## 9. Known risk

- No customer-facing content risk observed.
- Internal system labels are operator-facing/systemic and consistent with prior locales:
  - `varmrett`
  - category title: `Vegetar`
  - allergen tokens: soya, melk, hvete, egg
- Customer-facing content is German.
- Far-future unpublished drafts only.
- Customer-invisible.
- menuDay IDs are deterministic operational drafts, not published customer menu.
- Some allergens may live on catalog items rather than top-level menuDay docs.
- No further generator applies without separate scoped GO.
- SOT remains NO-GO.
- Auto-rollout remains NO-GO.

## 10. Next action

- Archive this evidence first.
- Then proceed to next Phase C locale onboarding dryRun-only under separate scoped GO.
- Next pending locale should be fr-FR if source rollout order confirms it.
- Do not start SOT.
- Do not auto-rollout.
- Do not run more generator applies without separate GO.
