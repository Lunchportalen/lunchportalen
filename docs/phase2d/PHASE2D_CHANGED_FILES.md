# Phase 2D — Changed files

## 2026-03-28 — Phase 2D0 (planning only)

Alle filer er **nye** under `docs/phase2d/`:

- `PHASE2D_BASELINE_DELTA_AUDIT.md`
- `SOCIAL_CALENDAR_RUNTIME_PLAN.md`
- `SEO_CMS_GROWTH_PLAN.md`
- `ESG_RUNTIME_PLAN.md`
- `AI_GROWTH_CONSOLIDATION_PLAN.md`
- `PHASE2D_BOUNDARIES.md`
- `PHASE2D_RISKS.md`
- `PHASE2D_DECISIONS.md`
- `PHASE2D_IMPLEMENTATION_SEQUENCE.md`
- `PHASE2D_EXECUTION_LOG.md`
- `PHASE2D_CHANGED_FILES.md` (this file)
- `PHASE2D_NEXT_STEPS.md`

**Ingen** endringer i `app/`, `lib/`, `components/`, `middleware.ts`, `supabase/`, eller konfigurasjon for deploy i 2D0.

---

## 2026-03-28 — Phase 2D1 (Social Calendar runtime MVP)

### Kode

- `lib/social/socialPostStatusCanonical.ts` (ny)
- `lib/social/socialPostUiModel.ts` (ny)
- `lib/social/socialPostContentMerge.ts` (ny)
- `app/api/social/posts/[id]/route.ts` (ny)
- `app/api/social/posts/publish/route.ts` (ny)
- `app/api/social/posts/save/route.ts`
- `app/(backoffice)/backoffice/social/page.tsx` (ny)
- `app/(backoffice)/backoffice/social/SocialCalendarRuntimeClient.tsx` (ny)
- `app/(backoffice)/backoffice/_shell/TopBar.tsx`
- `lib/superadmin/capabilities.ts`
- `lib/validation/schemas.ts`

### Tester

- `tests/social/social-post-status.test.ts` (ny)
- `tests/superadmin/capabilities-contract.test.ts`

### Dokumentasjon (`docs/phase2d/`)

- `SOCIAL_SOURCE_OF_TRUTH.md` (ny)
- `SOCIAL_CALENDAR_UI_RUNTIME.md` (ny)
- `SOCIAL_REVIEW_AND_EDIT_RUNTIME.md` (ny)
- `SOCIAL_SCHEDULE_AND_PUBLISH_RUNTIME.md` (ny)
- `SOCIAL_AI_MEDIA_BOUNDARY.md` (ny)
- `SOCIAL_VISUAL_RUNTIME.md` (ny)
- `PHASE2D_DECISIONS.md`, `PHASE2D_EXECUTION_LOG.md`, `PHASE2D_RISKS.md`, `PHASE2D_NEXT_STEPS.md` (oppdatert)

---

## 2026-03-28 — Phase 2D2 (SEO / CMS Growth runtime MVP)

### Kode

- `lib/cms/mergeSeoIntoVariantBody.ts` (ny)
- `app/(backoffice)/backoffice/seo-growth/page.tsx` (ny)
- `app/(backoffice)/backoffice/seo-growth/SeoGrowthRuntimeClient.tsx` (ny)
- `app/(backoffice)/backoffice/_shell/TopBar.tsx`
- `lib/superadmin/capabilities.ts`

### Tester

- `tests/cms/merge-seo-variant-body.test.ts` (ny)
- `tests/superadmin/capabilities-contract.test.ts`

### Dokumentasjon (`docs/phase2d/`)

- `SEO_SOURCE_OF_TRUTH.md` (ny)
- `SEO_CMS_UI_RUNTIME.md` (ny)
- `SEO_PAGE_RUNTIME.md` (ny)
- `SEO_TOPICAL_GROWTH_RUNTIME.md` (ny)
- `SEO_TECHNICAL_RUNTIME.md` (ny)
- `SEO_AI_BOUNDARY.md` (ny)
- `SEO_VISUAL_RUNTIME.md` (ny)
- `PHASE2D_DECISIONS.md`, `PHASE2D_EXECUTION_LOG.md`, `PHASE2D_RISKS.md`, `PHASE2D_NEXT_STEPS.md` (oppdatert)

---

## 2026-03-28 — Phase 2D3 (ESG runtime MVP)

### Kode

- `lib/esg/osloMonth.ts` (ny)
- `lib/esg/fetchCompanyEsgSnapshotSummary.ts` (ny)
- `lib/esg/latestMonthlyRollupList.ts` (ny)
- `app/api/backoffice/esg/summary/route.ts` (ny)
- `app/api/backoffice/esg/latest-monthly/route.ts` (ny)
- `app/api/admin/esg/summary/route.ts`
- `app/api/superadmin/esg/summary/route.ts`
- `app/api/superadmin/esg/latest-monthly/route.ts`
- `app/(backoffice)/backoffice/esg/page.tsx` (ny)
- `app/(backoffice)/backoffice/esg/EsgRuntimeClient.tsx` (ny)
- `app/(backoffice)/backoffice/_shell/TopBar.tsx`
- `lib/superadmin/capabilities.ts`

### Tester

- `tests/esg/oslo-month.test.ts` (ny)
- `tests/api/backofficeEsgSummaryRoute.test.ts` (ny)
- `tests/superadmin/capabilities-contract.test.ts`

### Dokumentasjon (`docs/phase2d/`)

- `ESG_SOURCE_OF_TRUTH.md` (ny)
- `ESG_UI_RUNTIME.md` (ny)
- `ESG_INSIGHTS_RUNTIME.md` (ny)
- `ESG_SURFACE_BOUNDARY.md` (ny)
- `ESG_METHOD_AND_TRUST_RUNTIME.md` (ny)
- `ESG_VISUAL_RUNTIME.md` (ny)
- `PHASE2D_DECISIONS.md`, `PHASE2D_EXECUTION_LOG.md`, `PHASE2D_RISKS.md`, `PHASE2D_NEXT_STEPS.md` (oppdatert)
