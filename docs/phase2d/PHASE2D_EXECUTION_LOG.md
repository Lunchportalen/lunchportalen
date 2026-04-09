# Phase 2D — Execution log

## 2026-03-28 — Phase 2D0 (Growth / SEO / Social / ESG planning)

**Type:** Kun dokumentasjon og beslutninger — **ingen** endringer i `app/`, `lib/`, `middleware`, auth, onboarding, week, order/window, billing, Supabase-migrasjoner eller Vercel.

### Leveranser

| Dokument | Innhold |
|----------|---------|
| `PHASE2D_BASELINE_DELTA_AUDIT.md` | Delta mot `REPO_DEEP_DIVE_REPORT.md` |
| `SOCIAL_CALENDAR_RUNTIME_PLAN.md` | SoMe-spor, API, flyt, integrasjoner |
| `SEO_CMS_GROWTH_PLAN.md` | SEO i CMS, AI, datakilder |
| `ESG_RUNTIME_PLAN.md` | Snapshots, RPC, visning, gap |
| `AI_GROWTH_CONSOLIDATION_PLAN.md` | Konsolidering av AI-flater |
| `PHASE2D_BOUNDARIES.md` | Sensitive områder og scope-grenser |
| `PHASE2D_RISKS.md` | Risiko-matrise |
| `PHASE2D_DECISIONS.md` | Source of truth og strategi |
| `PHASE2D_IMPLEMENTATION_SEQUENCE.md` | Rekkefølge 2D1–2D3 |
| `PHASE2D_CHANGED_FILES.md` | Liste over nye filer |
| `PHASE2D_NEXT_STEPS.md` | Hva som gjelder etter 2D0 |

### Gates (2D0)

- Ingen krav til `typecheck` / `build` for ren dokumentasjon i denne leveransen.

### Tester

- Ingen nye tester i 2D0 — fremtidige tester dokumentert per arbeidsstrøm.

### Stoppregel

- **Ikke** starte runtime-implementering av social, SEO eller ESG før eksplisitt 2D1+ scope.

---

## 2026-03-28 — Phase 2D1 (Social Calendar runtime MVP)

**Status:** Implementert — CMS `/backoffice/social`, `PATCH`/`publish` API-er, kanonisk status, dokumentasjon, tester.

### Kode (hovedpunkt)

- `lib/social/socialPostStatusCanonical.ts`, `socialPostUiModel.ts`, `socialPostContentMerge.ts`
- `app/api/social/posts/[id]/route.ts`, `app/api/social/posts/publish/route.ts`
- `app/api/social/posts/save/route.ts` (normalisert status, platform)
- `app/(backoffice)/backoffice/social/page.tsx`, `SocialCalendarRuntimeClient.tsx`
- `app/(backoffice)/backoffice/_shell/TopBar.tsx` (Social-fane)
- `lib/superadmin/capabilities.ts` (`bo-social-calendar`)
- `lib/validation/schemas.ts` (patch/publish schema)

### Dokumentasjon (`docs/phase2d/`)

- `SOCIAL_SOURCE_OF_TRUTH.md`, `SOCIAL_CALENDAR_UI_RUNTIME.md`, `SOCIAL_REVIEW_AND_EDIT_RUNTIME.md`, `SOCIAL_SCHEDULE_AND_PUBLISH_RUNTIME.md`, `SOCIAL_AI_MEDIA_BOUNDARY.md`, `SOCIAL_VISUAL_RUNTIME.md`
- `PHASE2D_DECISIONS.md`, `PHASE2D_CHANGED_FILES.md`, `PHASE2D_RISKS.md`, `PHASE2D_NEXT_STEPS.md` (oppdatert)

### Tester

- `tests/social/social-post-status.test.ts`
- `tests/superadmin/capabilities-contract.test.ts` (assert `bo-social-calendar`)

### Gates

- `npm run typecheck` — PASS  
- `npm run build:enterprise` — PASS

### Stoppregel (2D1)

- **Ikke** starte SEO-runtime (2D2) eller ESG-runtime (2D3) i samme leveranse.

---

## 2026-03-28 — Phase 2D2 (SEO / CMS Growth runtime MVP)

**Status:** Implementert — `/backoffice/seo-growth`, `mergeSeoFieldsIntoVariantBody` (`lib/cms/mergeSeoIntoVariantBody.ts`), integrasjon mot `seo-intelligence` og `PATCH` pages, dokumentasjon.

### Kode (hovedpunkt)

- `lib/cms/mergeSeoIntoVariantBody.ts`
- `app/(backoffice)/backoffice/seo-growth/page.tsx`, `SeoGrowthRuntimeClient.tsx`
- `app/(backoffice)/backoffice/_shell/TopBar.tsx` (SEO-fane)
- `lib/superadmin/capabilities.ts` (`bo-seo-growth`)

### Dokumentasjon (`docs/phase2d/`)

- `SEO_SOURCE_OF_TRUTH.md`, `SEO_CMS_UI_RUNTIME.md`, `SEO_PAGE_RUNTIME.md`, `SEO_TOPICAL_GROWTH_RUNTIME.md`, `SEO_TECHNICAL_RUNTIME.md`, `SEO_AI_BOUNDARY.md`, `SEO_VISUAL_RUNTIME.md`
- `PHASE2D_DECISIONS.md`, `PHASE2D_CHANGED_FILES.md`, `PHASE2D_RISKS.md`, `PHASE2D_NEXT_STEPS.md` (oppdatert)

### Tester

- `tests/cms/merge-seo-variant-body.test.ts`
- `tests/superadmin/capabilities-contract.test.ts` (`bo-seo-growth`)

### Gates

- `npm run typecheck` — PASS  
- `npm run build:enterprise` — PASS

### Stoppregel (2D2)

- **Ikke** starte ESG-runtime (2D3) eller skjult SEO-autopublisering i samme leveranse.

---

## 2026-03-28 — Phase 2D3 (ESG runtime MVP)

**Status:** Implementert — `/backoffice/esg`, `GET /api/backoffice/esg/summary`, `GET /api/backoffice/esg/latest-monthly`, delt `fetchCompanyEsgSnapshotSummary` + `loadLatestMonthlyRollupList`, dokumentasjon.

### Kode (hovedpunkt)

- `lib/esg/osloMonth.ts`, `lib/esg/fetchCompanyEsgSnapshotSummary.ts`, `lib/esg/latestMonthlyRollupList.ts`
- `app/api/backoffice/esg/summary/route.ts`, `app/api/backoffice/esg/latest-monthly/route.ts`
- `app/api/admin/esg/summary/route.ts`, `app/api/superadmin/esg/summary/route.ts`, `app/api/superadmin/esg/latest-monthly/route.ts` (refaktor til delt lib)
- `app/(backoffice)/backoffice/esg/page.tsx`, `EsgRuntimeClient.tsx`
- `app/(backoffice)/backoffice/_shell/TopBar.tsx` (ESG-fane)
- `lib/superadmin/capabilities.ts` (`bo-esg`)

### Dokumentasjon (`docs/phase2d/`)

- `ESG_SOURCE_OF_TRUTH.md`, `ESG_UI_RUNTIME.md`, `ESG_INSIGHTS_RUNTIME.md`, `ESG_SURFACE_BOUNDARY.md`, `ESG_METHOD_AND_TRUST_RUNTIME.md`, `ESG_VISUAL_RUNTIME.md`
- `PHASE2D_DECISIONS.md`, `PHASE2D_CHANGED_FILES.md`, `PHASE2D_RISKS.md`, `PHASE2D_NEXT_STEPS.md`, `PHASE2D_EXECUTION_LOG.md` (oppdatert)

### Tester

- `tests/esg/oslo-month.test.ts`
- `tests/api/backofficeEsgSummaryRoute.test.ts`
- `tests/superadmin/capabilities-contract.test.ts` (`bo-esg`)

### Gates

- `npm run typecheck` — PASS  
- `npm run build:enterprise` — PASS

### Stoppregel (2D3)

- **Ikke** starte nye funksjonsfaser automatisk; **ikke** skjult ESG-automatisering eller skriving til snapshots fra CMS.
