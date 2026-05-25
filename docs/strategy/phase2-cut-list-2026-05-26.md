# Phase 2 — Cut-list classification (FASE A, full repo)

**Date:** 2026-05-26  
**Mode:** READ-ONLY · ingen sletting før Thomas review  
**Baseline:** [phase2-ai-inventory-2026-05-26.md](./phase2-ai-inventory-2026-05-26.md)

---

## Crawl-scope (verifikasjon)

### Crawlet (consumer-graph)

| Område | Sti | Scope-type | Filer |
|--------|-----|------------|------:|
| lib | `lib` | kode | 1794 |
| app | `app` | kode | 1200 |
| components | `components` | kode | 334 |
| workers | `workers` | kode | 1 |
| scripts | `scripts` | scheduled | 253 |
| github | `.github/workflows` | scheduled | 15 |
| supabase_migrations | `supabase/migrations` | scheduled | 270 |
| tests | `tests` | tests | 516 |
| e2e | `e2e` | tests | 43 |
| studio | `studio` | cms | 40 |
| umbraco | `umbraco17/lunchportalen` | cms | 113 |
| docs | `docs` | docs | 1467 |
| vercel.json | `vercel.json` | scheduled | 1 |
| middleware.ts | `middleware.ts` | config | 1 |
| next.config.ts | `next.config.ts` | config | 1 |
| .env.example | `.env.example` | config | 1 |
| package.json | `package.json` | package | 1 |
| README.md | `README.md` | docs | 1 |
| CHANGELOG.md | `CHANGELOG.md` | docs | 1 |

**Corpus totalt:** 6053 filer indeksert for grep/import/consumer-graph.

### Skipped (eksplisitt)

| Path | Grunn |
|------|-------|
| `node_modules/` | Dependencies — ikke produksjonskilde |
| `.next/` | Build output |
| `dist/` | Build output |
| `build/` | Build output |

### Mangler / optional

- `supabase/functions` — optional — finnes ikke
- `lib/cron` — optional — finnes ikke
- `playwright` — optional — finnes ikke
- `cypress` — optional — finnes ikke
- `sanity` — optional — finnes ikke

**Hooks:** `hooks/**` finnes ikke som egen root — crawlet via `lib/hooks/`.

**Vercel crons:** 13 paths i `vercel.json` (ingen peker direkte på `/api/ai/*`).

**GitHub Actions:** 0 treff på `/api/ai` eller `@/lib/ai` i `.github/workflows/**`.

**Supabase Edge Functions:** `supabase/functions/` — mangler.

---

## Sammendrag

| Metrikk | Verdi |
|---------|------:|
| **AI-filer auditeret** (`lib/ai/**/*.ts`) | 277 |
| **Total LOC** | 29570 |
| **KEEP** | 132 filer (56.2% LOC) |
| **CUT** | 73 filer (15.2% LOC) |
| **REFACTOR** | 12 filer (7.5% LOC) |
| **INVESTIGATE** | 60 filer (21.1% LOC) |

**`app/api/ai/**` routes:** 29 (klassifisert i egen seksjon nederst).

---

## Verifikasjons-checklist (FASE A)

- [x] Scope crawlet: lib, app, components, workers, scripts, .github/workflows, vercel.json, supabase/migrations, studio, umbraco17, tests, e2e, docs, middleware, next.config, package.json
- [x] Per CUT: filename/path-grep, export-symbol (hvor relevant), route-path, vercel/actions/supabase-config sjekket
- [x] Per CUT: ingen test-consumers (ellers INVESTIGATE)
- [x] Per CUT: ikke Pillar 2 / ESG per Phase 2-docs
- [x] INVESTIGATE er ikke auto-CUT
- [x] Crawl-scope listet eksplisitt over

---

## Per-fil klassifisering (`lib/ai`)

| Fil | Class | LOC | Justification | Consumers funnet | Scope-områder sjekket |
|-----|-------|----:|---------------|------------------|------------------------|
| `_internalProvider.ts` | **INVESTIGATE** | 500 | Scheduled/config consumer (scripts/check-ai-internal-provider.mjs) — ikke auto-CUT. | scripts/check-ai-internal-provider.mjs; docs/audit/lib-ai-decision.md; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | scheduled,docs |
| `actions/mapDecisionToAction.ts` | **CUT** | 104 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `adaptiveLearning.ts` | **KEEP** | 914 | Verifisert prod consumer: app/api/ai/business-engine/route.ts (+7). | app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; lib/observability/graphMetrics.ts; app/api/ai/business-engine/route.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts (+3) | kode,docs |
| `adaptiveScoring.ts` | **INVESTIGATE** | 131 | Nevnt i strategi/runbook (docs/strategy/phase2-ai-inventory-2026-05-26.md) uten prod consumer. | docs/strategy/phase2-ai-inventory-2026-05-26.md | docs |
| `adsEngine.ts` | **KEEP** | 73 | Verifisert prod consumer: app/api/ai/growth/ads/route.ts (+2). | app/api/ai/growth/ads/route.ts; app/api/ai/growth/ads/route.ts; app/api/ai/growth/ads/route.ts | kode |
| `agents/ceoAgent.ts` | **CUT** | 30 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `agents/cmoAgent.ts` | **CUT** | 32 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `agents/contentHealthDaily.ts` | **KEEP** | 140 | Verifisert prod consumer: app/api/backoffice/ai/health/scan/route.ts (+2). | app/api/backoffice/ai/health/scan/route.ts; app/api/backoffice/ai/health/scan/route.ts; app/api/backoffice/ai/health/scan/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `agents/cooAgent.ts` | **CUT** | 20 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `agents/ctoAgent.ts` | **CUT** | 30 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `agents/index.ts` | **CUT** | 15 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `aiEntrypointContext.ts` | **KEEP** | 50 | Verifisert prod consumer: lib/http/withApiAiEntrypoint.ts (+1). | lib/http/withApiAiEntrypoint.ts; lib/system/controlStrict.ts; docs/audit/lib-ai-decision.md; docs/audit/repo-state-2026-05-23-post-marathon.md; docs/operations/api-auth-inventory.md; docs/operations/api-auth-inventory.md | kode,docs |
| `aiPageGuardrails.ts` | **KEEP** | 47 | Verifisert prod consumer: lib/hooks/useAiPageBuilder.ts (+2). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts | kode |
| `analysis/contentHealth.ts` | **INVESTIGATE** | 72 | Ambiguous etter full crawl — krever Thomas. | tests/ai/aiSystemGuarantees.test.ts; tests/ai/aiSystemGuarantees.test.ts; tests/ai/aiSystemGuarantees.test.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | tests,docs |
| `anomaly.ts` | **REFACTOR** | 52 | Verifisert prod consumer: app/superadmin/control-tower/actions.ts (+1). | app/superadmin/control-tower/actions.ts; app/superadmin/control-tower/ControlTowerClient.tsx; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `attribution.ts` | **KEEP** | 31 | Verifisert prod consumer: lib/business/revenue.ts (+9). | lib/business/revenue.ts; lib/revenue/trigger.ts; lib/business/revenue.ts; lib/business/revenue.ts; lib/business/revenueTrack.ts; lib/revenue/trackOrderAiConversion.ts (+6) | kode,docs |
| `attribution/aggregationEngine.ts` | **CUT** | 62 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `attribution/attributionModel.ts` | **KEEP** | 47 | Verifisert prod consumer: app/api/public/track-event/route.ts (+2). | app/api/public/track-event/route.ts; app/api/public/track-event/route.ts; app/api/public/track-event/route.ts | kode |
| `attribution/insightEngine.ts` | **CUT** | 19 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `attribution/roiEngine.ts` | **CUT** | 41 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `attribution/storeAttribution.ts` | **KEEP** | 42 | Verifisert prod consumer: app/api/public/track-event/route.ts (+4). | app/api/public/track-event/route.ts; lib/revenue/session.ts; app/api/public/track-event/route.ts; app/api/public/track-event/route.ts; components/revenue/AttributionCapture.tsx | kode |
| `audience.ts` | **CUT** | 23 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `autoImprove.ts` | **KEEP** | 82 | Verifisert prod consumer: app/api/backoffice/ai/auto-improve/route.ts (+2). | app/api/backoffice/ai/auto-improve/route.ts; tests/ai/autoImprove.test.ts; app/api/backoffice/ai/auto-improve/route.ts; app/api/backoffice/ai/auto-improve/route.ts; tests/ai/autoImprove.test.ts; tests/ai/autoImprove.test.ts (+1) | kode,tests,docs |
| `autonomy/automationLayer.ts` | **CUT** | 69 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `autonomy/autonomyAttribution.ts` | **INVESTIGATE** | 39 | CEO / autonomy meta — prod-importer finnes (app/api/backoffice/autonomy/feedback/route.ts). | app/api/backoffice/autonomy/feedback/route.ts; app/api/backoffice/autonomy/feedback/route.ts; app/api/backoffice/autonomy/feedback/route.ts | kode |
| `autonomy/autonomyLearning.ts` | **CUT** | 44 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `autonomy/autonomyLog.ts` | **INVESTIGATE** | 60 | CEO / autonomy meta — prod-importer finnes (app/(backoffice)/backoffice/ai-control/page.tsx). | app/(backoffice)/backoffice/ai-control/page.tsx; app/api/backoffice/autonomy/feedback/route.ts; app/(backoffice)/backoffice/ai-control/page.tsx; app/(backoffice)/backoffice/ai-control/page.tsx; app/api/backoffice/autonomy/feedback/route.ts; app/api/backoffice/autonomy/feedback/route.ts | kode |
| `autonomy/autonomyPolicy.ts` | **CUT** | 63 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `autonomy/collectDecisions.ts` | **CUT** | 37 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `autonomy/runner.ts` | **INVESTIGATE** | 137 | CEO / autonomy meta — prod-importer finnes (app/api/backoffice/autonomy/run/route.ts). | app/api/backoffice/autonomy/run/route.ts; lib/social/automationEngine.ts; lib/social/autonomousRunner.ts; app/api/backoffice/autonomy/run/route.ts; app/api/backoffice/autonomy/run/route.ts; app/api/social/run/route.ts (+1) | kode |
| `autonomy/types.ts` | **INVESTIGATE** | 50 | CEO / autonomy meta — prod-importer finnes (app/api/backoffice/autonomy/feedback/route.ts). | app/api/backoffice/autonomy/feedback/route.ts; lib/autonomy/execute.ts; lib/autonomy/mapActions.ts; lib/autonomy/policy.ts; lib/autonomy/run.ts; lib/autonomy/types.ts (+3) | kode |
| `autonomyController.ts` | **INVESTIGATE** | 65 | CEO / autonomy meta — prod-importer finnes (lib/autonomy/config.ts). | lib/autonomy/config.ts; lib/autonomy/override.ts; lib/autonomy/types.ts; lib/salesAutonomy/config.ts; lib/salesAutonomy/types.ts; app/api/superadmin/autonomy/route.ts (+1) | kode |
| `batchApply.ts` | **KEEP** | 145 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx (+2). | app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; docs/umbraco-parity/U22_COLLECTIONS_AND_ENTITY_ACTIONS_BASELINE.md; docs/umbraco-parity/U27_BULK_AND_LEGACY_BASELINE.md; docs/umbraco-parity/U30X_READ_R3_EXTENSION_TYPE_PARITY_MATRIX.md | kode,docs |
| `billing.ts` | **KEEP** | 271 | Verifisert prod consumer: lib/saas/billing.ts (+9). | lib/saas/billing.ts; app/api/ai/usage/route.ts; lib/copy/admin.copy.nb.json; lib/saas/billing.ts; lib/saas/billing.ts; lib/superadmin/capabilities.ts (+4) | kode |
| `blockFactory.ts` | **KEEP** | 138 | Verifisert prod consumer: lib/hooks/useAiPageBuilder.ts (+2). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts | kode |
| `blockSchema.ts` | **KEEP** | 411 | Verifisert prod consumer: lib/cms/blocks/componentRegistry.ts. | tests/lib/ai/blockSchema.test.ts; lib/cms/blocks/componentRegistry.ts; tests/lib/ai/blockSchema.test.ts; tests/lib/ai/blockSchema.test.ts; docs/audit/lib-ai-decision.md; docs/audit/parts/06e-paths-supabase-docs-tests-e2e.md (+1) | kode,tests,docs |
| `buildHomeFromIntentBody.ts` | **KEEP** | 131 | Verifisert prod consumer: app/api/backoffice/ai/build-home-from-intent/route.ts (+9). | app/api/backoffice/ai/build-home-from-intent/route.ts; lib/cms/cmsDraftEnvironment.ts; lib/experiments/applyWinnerToCms.ts; lib/experiments/createHomeTrafficExperimentCore.ts; app/(backoffice)/backoffice/content/_components/contentWorkspace.persistence.ts; app/(backoffice)/backoffice/content/_components/contentWorkspace.preview.ts (+5) | kode,docs |
| `businessMetrics.ts` | **KEEP** | 97 | Verifisert prod consumer: lib/observability/metricsEngine.ts (+5). | lib/observability/metricsEngine.ts; lib/observability/systemSnapshot.ts; lib/observability/metricsEngine.ts; lib/observability/metricsEngine.ts; lib/observability/systemSnapshot.ts; lib/observability/systemSnapshot.ts | kode |
| `businessObjective.ts` | **KEEP** | 985 | Verifisert prod consumer: lib/pos/signalCollector.ts (+7). | lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts; app/api/ai/business-engine/route.ts (+2) | kode |
| `capital/actionGenerator.ts` | **INVESTIGATE** | 23 | Capital / allocation (Pillar 1) — prod-importer finnes (lib/autonomy/engine.ts). | lib/autonomy/engine.ts; lib/autonomy/generateActions.ts; lib/ceo/actions.ts; lib/ceo/run.ts; lib/domination/engine.ts; lib/domination/index.ts (+8) | kode,tests |
| `capital/actionPriority.ts` | **CUT** | 14 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `capital/allocationEngine.ts` | **CUT** | 43 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `capital/capitalOutput.ts` | **CUT** | 27 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `capital/capitalState.ts` | **CUT** | 69 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `capital/executionEngine.ts` | **CUT** | 20 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `capital/executionPlan.ts` | **CUT** | 18 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `capital/investmentAreas.ts` | **CUT** | 11 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `capital/riskEngine.ts` | **CUT** | 22 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `capital/roiEngine.ts` | **CUT** | 22 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `ceo/attribution.ts` | **INVESTIGATE** | 36 | CEO / autonomy meta — prod-importer finnes (app/api/backoffice/ceo/feedback/route.ts). | app/api/backoffice/ceo/feedback/route.ts; app/api/backoffice/ceo/feedback/route.ts; app/api/backoffice/ceo/feedback/route.ts | kode |
| `ceo/automationEngine.ts` | **INVESTIGATE** | 63 | CEO / autonomy meta — prod-importer finnes (app/api/pipeline/actions/route.ts). | app/api/pipeline/actions/route.ts | kode |
| `ceo/ceoLog.ts` | **INVESTIGATE** | 55 | CEO / autonomy meta — prod-importer finnes (app/(backoffice)/backoffice/control/page.tsx). | app/(backoffice)/backoffice/control/page.tsx; app/api/backoffice/ceo/feedback/route.ts; app/(backoffice)/backoffice/control/page.tsx; app/(backoffice)/backoffice/control/page.tsx; app/api/backoffice/ceo/feedback/route.ts; app/api/backoffice/ceo/feedback/route.ts | kode |
| `ceo/decisionEngine.ts` | **INVESTIGATE** | 169 | CEO / autonomy meta — prod-importer finnes (app/api/backoffice/ceo/recommendations/route.ts). | app/api/backoffice/ceo/recommendations/route.ts; app/api/backoffice/ceo/recommendations/route.ts; app/api/backoffice/ceo/recommendations/route.ts | kode |
| `ceo/growthEngine.ts` | **INVESTIGATE** | 53 | CEO / autonomy meta — prod-importer finnes (app/api/backoffice/ceo/recommendations/route.ts). | app/api/backoffice/ceo/recommendations/route.ts; app/api/backoffice/ceo/recommendations/route.ts; app/api/backoffice/ceo/recommendations/route.ts | kode |
| `ceo/learning.ts` | **CUT** | 43 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `ceo/policyEngine.ts` | **INVESTIGATE** | 51 | CEO / autonomy meta — prod-importer finnes (lib/autonomy/execute.ts). | lib/autonomy/execute.ts; lib/autonomy/policy.ts | kode |
| `ceo/runner.ts` | **INVESTIGATE** | 131 | CEO / autonomy meta — prod-importer finnes (app/api/backoffice/ceo/run/route.ts). | app/api/backoffice/ceo/run/route.ts; app/api/backoffice/ceo/run/route.ts; app/api/backoffice/ceo/run/route.ts | kode |
| `ceo/types.ts` | **INVESTIGATE** | 66 | CEO / autonomy meta — prod-importer finnes (app/api/backoffice/ceo/feedback/route.ts). | app/api/backoffice/ceo/feedback/route.ts; app/(backoffice)/backoffice/content/_components/EditorCeoRecommendationsPanel.tsx; app/api/backoffice/ceo/feedback/route.ts; app/api/backoffice/ceo/feedback/route.ts | kode |
| `ceoExecutor.ts` | **INVESTIGATE** | 27 | CEO / autonomy meta — prod-importer finnes (lib/autopilot/engine.ts). | lib/autopilot/engine.ts; lib/autopilot/engine.ts; lib/autopilot/engine.ts | kode |
| `cmsAiActions.ts` | **KEEP** | 14 | Verifisert prod consumer: app/api/backoffice/ai/cms-menu/route.ts (+2). | app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cms-menu/route.ts; tests/ai/cmsAiEngine.heuristic.test.ts | kode,tests |
| `cmsAiEngine.ts` | **REFACTOR** | 278 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts (+2). | app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; tests/ai/cmsAiEngine.heuristic.test.ts; app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/api/backoffice/ai/cms-menu/route.ts; tests/ai/cmsAiEngine.heuristic.test.ts; tests/ai/cmsAiEngine.heuristic.test.ts (+3) | kode,tests,docs |
| `cmsAiPrompts.ts` | **CUT** | 105 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `cmsAiTenant.ts` | **KEEP** | 50 | Verifisert prod consumer: app/api/backoffice/ai/suggest/route.ts (+2). | app/api/backoffice/ai/suggest/route.ts; tests/ai/cmsAiTenant.test.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; tests/ai/CmsAiAuthRuntimeParity.test.ts; tests/ai/cmsAiTenant.test.ts (+1) | kode,tests |
| `cmsAiTypes.ts` | **CUT** | 43 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `company/actionTypes.ts` | **CUT** | 62 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `company/anomaly.ts` | **CUT** | 69 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `company/automationEngine.ts` | **INVESTIGATE** | 178 | Company meta-engine — prod-importer finnes (app/api/backoffice/company/control-tower/route.ts). | app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `company/decisionEngine.ts` | **CUT** | 135 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `company/memory.ts` | **INVESTIGATE** | 48 | Company meta-engine — prod-importer finnes (app/api/backoffice/company/control-tower/route.ts). | app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `company/policyEngine.ts` | **INVESTIGATE** | 244 | Company meta-engine — prod-importer finnes (app/api/backoffice/company/control-tower/route.ts). | app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `company/safety.ts` | **CUT** | 48 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `company/types.ts` | **INVESTIGATE** | 106 | Company meta-engine — prod-importer finnes (app/api/backoffice/company/control-tower/route.ts). | app/api/backoffice/company/control-tower/route.ts; app/(backoffice)/backoffice/content/_components/EditorAiControlTowerPanel.tsx; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `config.ts` | **KEEP** | 41 | Verifisert prod consumer: lib/cms/public/normalizeBlockForRender.ts (+1). | lib/cms/public/normalizeBlockForRender.ts; app/(backoffice)/backoffice/content/_components/CmsBlockDesignSection.tsx; scripts/k6/results/2026-05-23T19-20-53-681Z-summary-export.json; scripts/k6/results/2026-05-23T19-21-26-051Z-summary.json; scripts/k6/results/2026-05-23T19-23-32-503Z-summary-export.json; scripts/k6/results/2026-05-23T19-24-04-958Z-summary.json (+36) | kode,scheduled,cms,docs |
| `context.ts` | **KEEP** | 98 | Verifisert prod consumer: app/api/ai/copilot/route.ts (+5). | app/api/ai/copilot/route.ts; lib/sales/context.ts; lib/sales/handleObjection.ts; app/api/ai/copilot/route.ts; app/api/ai/copilot/route.ts; app/api/backoffice/company/control-tower/route.ts (+6) | kode,docs |
| `context/systemContext.ts` | **KEEP** | 92 | Verifisert prod consumer: app/api/backoffice/company/control-tower/route.ts (+2). | app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `continuation.ts` | **KEEP** | 66 | Verifisert prod consumer: app/api/ai/continue/route.ts (+2). | app/api/ai/continue/route.ts; app/api/ai/continue/route.ts; app/api/ai/continue/route.ts | kode |
| `control/controlGate.ts` | **INVESTIGATE** | 49 | Kun test-consumers (3) — test-only/legacy. | tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts | tests |
| `control/ethicsEngine.ts` | **INVESTIGATE** | 15 | Kun test-consumers (3) — test-only/legacy. | tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts | tests |
| `control/explainEngine.ts` | **INVESTIGATE** | 18 | Kun test-consumers (3) — test-only/legacy. | tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts | tests |
| `control/governanceEngine.ts` | **KEEP** | 18 | Verifisert prod consumer: lib/autonomy/engine.ts (+1). | tests/ai/controlLayer.test.ts; lib/autonomy/engine.ts; lib/autonomy/validator.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/autonomy/autonomy-pure.test.ts | kode,tests |
| `control/killSwitch.ts` | **INVESTIGATE** | 11 | Ambiguous etter full crawl — krever Thomas. | tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; docs/audit/lib-ai-decision.md; docs/audit/lib-ai-decision.md | tests,docs |
| `control/normalizeControlType.ts` | **CUT** | 19 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `control/overrideEngine.ts` | **CUT** | 12 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `control/riskEngine.ts` | **KEEP** | 13 | Verifisert prod consumer: lib/simulation/risk.ts (+1). | tests/ai/controlLayer.test.ts; lib/simulation/risk.ts; app/superadmin/control-tower/ControlTowerClient.tsx; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/finance/finance-and-simulation.test.ts | kode,tests |
| `controlTower/actionRegistry.ts` | **INVESTIGATE** | 25 | Control-tower meta — prod-importer finnes (app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts). | app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts; app/api/control-tower/route.ts; tests/ai/controlTower.test.ts; app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts; app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts; app/api/control-tower/route.ts (+3) | kode,tests |
| `controlTower/controlExecutor.ts` | **INVESTIGATE** | 109 | Control-tower meta — prod-importer finnes (app/api/control-tower/route.ts). | app/api/control-tower/route.ts; app/api/control-tower/route.ts; app/api/control-tower/route.ts | kode |
| `conversion/engine.ts` | **CUT** | 67 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `conversionGenerator.ts` | **KEEP** | 57 | Verifisert prod consumer: lib/social/unifiedGenerator.ts (+3). | lib/social/unifiedGenerator.ts; lib/social/unifiedGenerator.ts; lib/social/unifiedGenerator.ts; app/api/social/ai/generate/route.ts; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `copilot.ts` | **KEEP** | 92 | Verifisert prod consumer: app/api/ai/copilot/route.ts (+7). | app/api/ai/copilot/route.ts; app/(backoffice)/backoffice/content/_components/ContentWorkspaceRightRail.tsx; app/(backoffice)/backoffice/content/_components/contentWorkspaceRightRailSlots.ts; app/(backoffice)/backoffice/content/_components/EditorCopilotRail.tsx; app/(backoffice)/backoffice/content/_components/useContentWorkspaceCopilot.ts; app/api/ai/copilot/route.ts (+11) | kode,scheduled,tests,docs |
| `croAnalyzer.ts` | **INVESTIGATE** | 97 | Nevnt i strategi/runbook (docs/strategy/phase2-ai-inventory-2026-05-26.md) uten prod consumer. | docs/strategy/phase2-ai-inventory-2026-05-26.md | docs |
| `crossSurfaceLearning.ts` | **INVESTIGATE** | 44 | Meta-engine root stubs — prod-importer finnes (lib/pos/crossSurfaceLearning.ts). | lib/pos/crossSurfaceLearning.ts; lib/pos/crossSurfaceLearning.ts; lib/pos/crossSurfaceLearning.ts; lib/pos/index.ts; lib/pos/learningRouter.ts | kode |
| `ctaOptimizer.ts` | **KEEP** | 11 | Verifisert prod consumer: lib/social/unifiedGenerator.ts (+2). | lib/social/unifiedGenerator.ts; lib/social/unifiedGenerator.ts; lib/social/unifiedGenerator.ts | kode |
| `dashboard.ts` | **KEEP** | 88 | Verifisert prod consumer: app/api/ai/dashboard/route.ts (+10). | app/api/ai/dashboard/route.ts; lib/copy/admin.copy.nb.json; app/(backoffice)/backoffice/ai/overview/page.tsx; app/(backoffice)/backoffice/content/_tree/treeMock.ts; app/api/ai/business-engine/route.ts; app/api/ai/dashboard/route.ts (+26) | kode,scheduled,tests,cms,docs |
| `dashboardEngine.ts` | **KEEP** | 232 | Verifisert prod consumer: app/api/ai/usage/route.ts (+2). | app/api/ai/usage/route.ts; app/api/ai/usage/route.ts; app/api/ai/usage/route.ts | kode |
| `debounce.ts` | **KEEP** | 14 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/useContentWorkspaceCopilot.ts (+13). | app/(backoffice)/backoffice/content/_components/useContentWorkspaceCopilot.ts; app/(backoffice)/backoffice/content/_components/useContentWorkspaceRichTextAi.ts; app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts; lib/pos/eventHandler.ts; app/(backoffice)/backoffice/content/_components/CONTENT_WORKSPACE_NAVIGATION_CLUSTER_MAP.md; app/(backoffice)/backoffice/content/_components/CONTENT_WORKSPACE_RESPONSIBILITY_MAP.md (+17) | kode,cms,docs |
| `decisionEngine.ts` | **KEEP** | 271 | Verifisert prod consumer: lib/http/withApiAiEntrypoint.ts (+25). | lib/http/withApiAiEntrypoint.ts; lib/pos/decisionRouter.ts; lib/pos/executionRouter.ts; lib/pos/posActionMemory.ts; lib/pos/posStabilizer.ts; lib/pos/signalCollector.ts (+20) | kode |
| `decisionId.ts` | **CUT** | 13 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `decisionLog.ts` | **KEEP** | 56 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+23). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/SocialContentCalendar.tsx; lib/ceo/buildSnapshot.ts; lib/evolution/decide.ts; lib/evolution/types.ts; lib/growth/profitOptimizationPipeline.ts (+76) | kode,scheduled,docs |
| `decisions.ts` | **KEEP** | 39 | Verifisert prod consumer: lib/social/automationEngine.ts. | lib/social/automationEngine.ts | kode |
| `demandData.ts` | **KEEP** | 103 | Pillar 2/ESG-kjerne på live route (200 uten LLM). | app/api/admin/demand-insights/route.ts; app/api/admin/operations-tower/route.ts; app/api/kitchen/demand-forecast/route.ts; app/api/order/week-demand-hints/route.ts; app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts (+10) | kode,docs |
| `demandEngine.ts` | **REFACTOR** | 224 | Pillar 2/ESG-kjerne på live route (200 uten LLM). | app/api/admin/demand-insights/route.ts; app/api/admin/operations-tower/route.ts; app/api/kitchen/demand-forecast/route.ts; app/kitchen/KitchenView.tsx; app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts (+13) | kode,docs |
| `demandInsights.ts` | **REFACTOR** | 114 | Pillar 2/ESG-kjerne på live route (200 uten LLM). | app/api/admin/demand-insights/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts (+4) | kode,docs |
| `design/analyzeDesign.ts` | **KEEP** | 135 | Verifisert prod consumer: app/api/ai/design/analyze/route.ts. | tests/ai/analyzeDesign.test.ts; app/api/ai/design/analyze/route.ts; tests/ai/analyzeDesign.test.ts; tests/ai/analyzeDesign.test.ts; docs/audit/lib-ai-decision.md; docs/audit/parts/06e-paths-supabase-docs-tests-e2e.md | kode,tests,docs |
| `design/applyDesignChanges.ts` | **KEEP** | 103 | Verifisert prod consumer: app/api/backoffice/ai/design-optimizer/analyze/route.ts (+8). | app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts (+3) | kode |
| `design/designMetrics.ts` | **KEEP** | 75 | Verifisert prod consumer: app/api/backoffice/ai/design-optimizer/analyze/route.ts (+5). | app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts | kode |
| `design/designPolicy.ts` | **KEEP** | 116 | Verifisert prod consumer: app/api/backoffice/ai/design-optimizer/apply/route.ts (+2). | app/api/backoffice/ai/design-optimizer/apply/route.ts; tests/ai/designPolicy.test.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; tests/ai/designPolicy.test.ts; tests/ai/designPolicy.test.ts | kode,tests |
| `design/designSettingsOptimizer.ts` | **KEEP** | 312 | Verifisert prod consumer: app/api/backoffice/ai/design-optimizer/analyze/route.ts (+11). | app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/revert/route.ts; app/api/backoffice/company/control-tower/route.ts; tests/ai/designSettingsOptimizer.test.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts (+9) | kode,tests |
| `design/lastDesignApply.ts` | **KEEP** | 48 | Verifisert prod consumer: app/api/backoffice/ai/design-optimizer/apply/route.ts (+2). | app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts | kode |
| `design/suggestDesignImprovements.ts` | **CUT** | 103 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `design/types.ts` | **INVESTIGATE** | 55 | Kun test-consumers (2) — test-only/legacy. | tests/ai/designPolicy.test.ts; tests/ai/designPolicy.test.ts | tests |
| `designAnalyzer.ts` | **KEEP** | 203 | Verifisert prod consumer: app/api/ai/design/analyze/route.ts (+2). | app/api/ai/design/analyze/route.ts; app/api/ai/design/analyze/route.ts; app/api/ai/design/analyze/route.ts; tests/ai/analyzeDesign.test.ts; docs/audit/lib-ai-decision.md; docs/audit/parts/06e-paths-supabase-docs-tests-e2e.md | kode,tests,docs |
| `designGenerator.ts` | **KEEP** | 115 | Verifisert prod consumer: app/api/ai/design/generate/route.ts (+2). | app/api/ai/design/generate/route.ts; app/api/ai/design/generate/route.ts; app/api/ai/design/generate/route.ts | kode |
| `designTokens.ts` | **KEEP** | 71 | Verifisert prod consumer: lib/pos/executionRouter.ts (+9). | lib/pos/executionRouter.ts; lib/pos/surfaceRegistry.ts; app/api/ai/design/generate/route.ts; lib/pos/executionRouter.ts; lib/pos/executionRouter.ts; lib/pos/index.ts (+5) | kode,docs |
| `editorRewrite.ts` | **REFACTOR** | 88 | Verifisert prod consumer: components/cms/AiTextAssistPopover.tsx (+2). | components/cms/AiTextAssistPopover.tsx; components/cms/AiTextAssistPopover.tsx; components/cms/AiTextAssistPopover.tsx | kode |
| `editorTextSuggest.ts` | **REFACTOR** | 85 | Verifisert prod consumer: lib/autonomy/apply.ts (+32). | lib/autonomy/apply.ts; lib/autonomy/runRevenue.ts; lib/business/runEngine.ts; lib/experiment/generate.ts; lib/experiment/generateCopyVariant.ts; lib/experiment/growthExperiment.ts (+35) | kode,docs |
| `engine.ts` | **KEEP** | 119 | Verifisert prod consumer: lib/pos/signalCollector.ts (+6). | lib/pos/signalCollector.ts; app/api/ai/analyze/route.ts; lib/pos/events.ts; lib/pos/signalCollector.ts; lib/pos/signalCollector.ts; app/api/ai/analyze/route.ts (+7) | kode,docs |
| `enrichPageBuilderBlocks.ts` | **CUT** | 67 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `enterprise/buildDashboardPayload.ts` | **KEEP** | 91 | Verifisert prod consumer: app/(backoffice)/backoffice/enterprise/page.tsx (+2). | app/(backoffice)/backoffice/enterprise/page.tsx; docs/audit/current-menu-architecture.md; app/(backoffice)/backoffice/enterprise/page.tsx; app/(backoffice)/backoffice/enterprise/page.tsx; docs/audit/current-menu-architecture.md; docs/audit/current-menu-architecture.md | kode,docs |
| `enterprise/enterpriseLog.ts` | **KEEP** | 48 | Verifisert prod consumer: app/(backoffice)/backoffice/enterprise/page.tsx (+2). | app/(backoffice)/backoffice/enterprise/page.tsx; docs/audit/current-menu-architecture.md; app/(backoffice)/backoffice/enterprise/page.tsx; app/(backoffice)/backoffice/enterprise/page.tsx; docs/audit/current-menu-architecture.md; docs/audit/current-menu-architecture.md | kode,docs |
| `enterprise/pageInsights.ts` | **KEEP** | 79 | Verifisert prod consumer: app/api/backoffice/enterprise/page-insights/route.ts (+2). | app/api/backoffice/enterprise/page-insights/route.ts; app/api/backoffice/enterprise/page-insights/route.ts; app/api/backoffice/enterprise/page-insights/route.ts | kode |
| `entitlements.ts` | **CUT** | 39 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `evaluator.ts` | **CUT** | 36 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `events/triggers.ts` | **CUT** | 22 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `evolve.ts` | **CUT** | 38 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `experienceModel.ts` | **CUT** | 65 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `experiment.ts` | **REFACTOR** | 77 | Verifisert prod consumer: app/api/ai/experiments/route.ts (+22). | app/api/ai/experiments/route.ts; lib/backoffice/experiments/experimentsRepo.ts; lib/experiment/growthExperiment.ts; lib/experiment/model.ts; lib/experiments/createHomeTrafficExperimentCore.ts; lib/experiments/overlayRunningExperiment.ts (+51) | kode,scheduled,tests,docs |
| `experimentGenerator.ts` | **INVESTIGATE** | 29 | Meta-engine root stubs — prod-importer finnes (lib/experiments/createHomeTrafficExperimentCore.ts). | lib/experiments/createHomeTrafficExperimentCore.ts; lib/experiments/createHomeTrafficExperimentCore.ts; lib/experiments/createHomeTrafficExperimentCore.ts | kode |
| `experimentWinnerDecision.ts` | **KEEP** | 227 | Verifisert prod consumer: lib/experiments/overlayRunningExperiment.ts (+15). | lib/experiments/overlayRunningExperiment.ts; app/api/backoffice/experiments/resolve/route.ts; lib/autopilot/runner.ts; lib/experiment/runSocialAbEvaluations.ts; lib/experiment/winner.ts; lib/experiments/overlayRunningExperiment.ts (+10) | kode |
| `experiments/aiExperimentsRepo.ts` | **KEEP** | 279 | Verifisert prod consumer: lib/experiment/growthExperiment.ts (+5). | lib/experiment/growthExperiment.ts; app/api/superadmin/experiments/route.ts; lib/experiment/growthExperiment.ts; lib/experiment/growthExperiment.ts; app/api/superadmin/experiments/route.ts; app/api/superadmin/experiments/route.ts (+2) | kode,docs |
| `experiments/analytics.ts` | **KEEP** | 77 | Verifisert prod consumer: app/api/backoffice/experiments/event/route.ts (+9). | app/api/backoffice/experiments/event/route.ts; app/api/backoffice/experiments/stats/route.ts; app/api/backoffice/experiments/[id]/route.ts; tests/backoffice/experimentAnalytics.test.ts; lib/experiment/evaluate.ts; app/api/backoffice/experiments/event/route.ts (+13) | kode,tests,docs |
| `experiments/revenueExperimentHints.ts` | **CUT** | 66 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `fallbackHandler.ts` | **KEEP** | 118 | Verifisert prod consumer: app/api/backoffice/ai/suggest/route.ts (+2). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts | kode |
| `feedback.ts` | **KEEP** | 256 | Verifisert prod consumer: lib/pos/learningRouter.ts (+3). | lib/pos/learningRouter.ts; lib/pos/learningRouter.ts; lib/pos/learningRouter.ts; app/(backoffice)/backoffice/design/page.tsx | kode |
| `funnelEngine.ts` | **KEEP** | 111 | Verifisert prod consumer: app/api/ai/growth/funnel/route.ts (+2). | app/api/ai/growth/funnel/route.ts; app/api/ai/growth/funnel/route.ts; app/api/ai/growth/funnel/route.ts | kode |
| `generateVariant.ts` | **KEEP** | 31 | Verifisert prod consumer: lib/experiment/generate.ts (+2). | tests/ai/generateVariant.test.ts; lib/experiment/generate.ts; lib/moo/generateVariant.ts; lib/revenue/applyLoop.ts; tests/ai/generateVariant.test.ts; tests/ai/generateVariant.test.ts (+1) | kode,tests,docs |
| `generator.ts` | **KEEP** | 99 | Verifisert prod consumer: app/api/ai/generate/route.ts (+2). | app/api/ai/generate/route.ts; app/api/ai/generate/route.ts; app/api/ai/generate/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `getClient.ts` | **KEEP** | 19 | Verifisert prod consumer: lib/sales/aiResponse.ts (+5). | lib/sales/aiResponse.ts; lib/sales/sequenceMessage.ts; lib/sales/aiResponse.ts; lib/sales/aiResponse.ts; lib/sales/sequenceMessage.ts; lib/sales/sequenceMessage.ts (+3) | kode,docs |
| `ghostText.ts` | **KEEP** | 27 | Verifisert prod consumer: app/api/ai/inline/route.ts (+2). | app/api/ai/inline/route.ts; app/api/ai/inline/route.ts; app/api/ai/inline/route.ts | kode |
| `governance/aiPolicy.ts` | **KEEP** | 124 | Verifisert prod consumer: app/api/system/ai/diagnostics/route.ts (+1). | app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `governanceApplySafety.ts` | **CUT** | 274 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `governor.ts` | **CUT** | 46 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `image.ts` | **KEEP** | 51 | Verifisert prod consumer: app/api/ai/image/route.ts (+44). | app/api/ai/image/route.ts; lib/cms/blocks/blockEditorDataTypes.ts; lib/cms/blocks/blockTypeDefinitions.ts; lib/cms/design/designContract.ts; lib/cms/editorSmartHints.ts; lib/cms/media/resolveBlockMediaDeep.ts (+100) | kode,scheduled,tests,cms,docs |
| `improveContent.ts` | **KEEP** | 21 | Verifisert prod consumer: lib/experiment/generateCopyVariant.ts (+7). | lib/experiment/generateCopyVariant.ts; lib/experiment/growthExperiment.ts; lib/content/improve.ts; lib/experiment/generateCopyVariant.ts; lib/experiment/generateCopyVariant.ts; lib/experiment/growthExperiment.ts (+2) | kode |
| `improvementEngine.ts` | **KEEP** | 162 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx (+2). | app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx | kode |
| `industry.ts` | **KEEP** | 25 | Verifisert prod consumer: lib/growth/growthAttributionInsights.ts (+42). | lib/growth/growthAttributionInsights.ts; lib/leads/createLead.ts; lib/leads/types.ts; lib/outbound/normalizeSegment.ts; lib/social/b2bLeadMessaging.ts; lib/social/calendar.ts (+37) | kode |
| `inline.ts` | **KEEP** | 50 | Verifisert prod consumer: app/api/ai/inline/route.ts (+14). | app/api/ai/inline/route.ts; lib/media/types.ts; app/(backoffice)/backoffice/content/_components/ContentDetailCompactBlockFrame.tsx; app/api/ai/inline/route.ts; app/api/ai/inline/route.ts; components/cms/blockCanvas/frames/CardsCanvasFrame.tsx (+18) | kode,tests,cms,docs |
| `insertAiSuggestionRow.ts` | **KEEP** | 91 | Verifisert prod consumer: app/api/backoffice/ai/suggest/route.ts (+5). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggestions/[id]/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggestions/[id]/route.ts; app/api/backoffice/ai/suggestions/[id]/route.ts | kode |
| `insightsEngine.ts` | **CUT** | 59 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `intelligence/confidence.ts` | **CUT** | 70 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `intelligence/index.ts` | **INVESTIGATE** | 98 | Intelligence meta — prod-importer finnes (app/api/ai/decision/route.ts). | app/api/ai/decision/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/intelligence/dashboard/route.ts; app/api/backoffice/ai/intelligence/events/route.ts; app/api/backoffice/ai/intelligence/query/route.ts (+10) | kode,tests,docs |
| `intelligence/learning.ts` | **INVESTIGATE** | 73 | Intelligence meta — prod-importer finnes (app/api/backoffice/ai/design-optimizer/apply/route.ts). | app/api/backoffice/ai/design-optimizer/apply/route.ts | kode |
| `intelligence/patterns.ts` | **CUT** | 363 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `intelligence/query.ts` | **INVESTIGATE** | 89 | Intelligence meta — prod-importer finnes (app/api/backoffice/ai/intelligence/query/route.ts). | app/api/backoffice/ai/intelligence/query/route.ts | kode |
| `intelligence/scale.ts` | **INVESTIGATE** | 291 | Intelligence meta — prod-importer finnes (lib/growth/scale-engine.ts). | lib/growth/scale-engine.ts; app/api/backoffice/company/control-tower/route.ts; docs/audit/repo-state-2026-05-23-deep-crawl.md | kode,docs |
| `intelligence/scaleApply.ts` | **INVESTIGATE** | 270 | Intelligence meta — prod-importer finnes (app/api/backoffice/company/control-tower/route.ts). | app/api/backoffice/company/control-tower/route.ts | kode |
| `intelligence/scaleDecision.ts` | **CUT** | 112 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `intelligence/scalePolicy.ts` | **CUT** | 86 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `intelligence/signals.ts` | **CUT** | 153 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `intelligence/store.ts` | **INVESTIGATE** | 217 | Intelligence meta — prod-importer finnes (lib/observability/eventLogger.ts). | lib/observability/eventLogger.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/intelligence/events/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/content/pages/[id]/variant/publish/route.ts; app/api/backoffice/experiments/[id]/route.ts (+10) | kode,scheduled,tests,docs |
| `intelligence/systemIntelligence.ts` | **INVESTIGATE** | 71 | Intelligence meta — prod-importer finnes (app/api/ai/decision/route.ts). | app/api/ai/decision/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/intelligence/dashboard/route.ts; app/api/backoffice/ai/intelligence/events/route.ts; app/api/backoffice/ai/intelligence/query/route.ts (+9) | kode,docs |
| `intelligence/trends.ts` | **CUT** | 95 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `intelligence/types.ts` | **INVESTIGATE** | 80 | Intelligence meta — prod-importer finnes (app/(backoffice)/backoffice/intelligence/page.tsx). | app/(backoffice)/backoffice/intelligence/page.tsx; lib/observability/eventLogger.ts; app/(backoffice)/backoffice/intelligence/page.tsx; app/(backoffice)/backoffice/intelligence/page.tsx | kode |
| `jobs/backoff.ts` | **INVESTIGATE** | 12 | Nevnt i strategi/runbook (docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md) uten prod consumer. | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md; docs/strategy/ai-feature-inventory-2026-05-26.md | docs |
| `jobs/claim.ts` | **INVESTIGATE** | 49 | Nevnt i strategi/runbook (docs/db-cleanup-report.md) uten prod consumer. | docs/db-cleanup-report.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `jobs/runner.ts` | **KEEP** | 227 | Verifisert prod consumer: app/api/backoffice/ai/jobs/run/route.ts (+2). | app/api/backoffice/ai/jobs/run/route.ts; app/api/backoffice/ai/jobs/run/route.ts; app/api/backoffice/ai/jobs/run/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `keywords.ts` | **INVESTIGATE** | 41 | CMS-schema referanse (studio/lunchportalen-studio/package.json) — f.eks. Sanity aiMenuLearning. | studio/lunchportalen-studio/package.json; studio/package.json | cms |
| `layout.ts` | **KEEP** | 67 | Verifisert prod consumer: lib/moo/generateVariant.ts (+21). | lib/moo/generateVariant.ts; lib/moo/generateVariantsDiverse.ts; app/api/ai/layout/route.ts; lib/cms/backofficeBlockCatalog.ts; lib/cms/blocks/blockTypeDefinitions.ts; lib/cms/design/designContract.ts (+31) | kode,scheduled,tests,cms,docs |
| `layoutRules.ts` | **KEEP** | 32 | Verifisert prod consumer: lib/hooks/useAiPageBuilder.ts (+2). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts | kode |
| `learning.ts` | **KEEP** | 211 | Verifisert prod consumer: lib/pos/learningRouter.ts (+16). | lib/pos/learningRouter.ts; lib/pos/posAdaptivePersistence.ts; app/api/ai/insights/route.ts; app/api/ai/learn/route.ts; lib/global/learningStore.ts; lib/global/runGlobalLearningCycle.ts (+13) | kode,docs |
| `learningBySurface.ts` | **CUT** | 41 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `logActivity.ts` | **KEEP** | 74 | Verifisert prod consumer: app/api/ai/analyze/route.ts (+20). | app/api/ai/analyze/route.ts; app/api/ai/block/route.ts; app/api/ai/experiments/route.ts; app/api/ai/generate/route.ts; app/api/ai/optimize/route.ts; app/api/ai/page/audit/route.ts (+15) | kode |
| `logging/aiActivityLogRow.ts` | **KEEP** | 99 | Verifisert prod consumer: lib/audit/aiActivityAudit.ts (+194). | lib/audit/aiActivityAudit.ts; lib/autonomy/audit.ts; lib/autonomy/override.ts; lib/autonomy/runRevenue.ts; lib/autopilot/experimentProposal.ts; lib/autopilot/log.ts (+198) | kode,scheduled,docs |
| `logging/aiExecutionLog.ts` | **KEEP** | 117 | Verifisert prod consumer: lib/alerts/dispatcher.ts (+20). | lib/alerts/dispatcher.ts; lib/autonomy/engine.ts; lib/social/observability.ts; app/api/superadmin/control-tower/autopilot/route.ts; app/api/superadmin/control-tower/scale/route.ts; app/superadmin/control-tower/actions.ts (+19) | kode,docs |
| `logging/insertAiActivityLogCompat.ts` | **KEEP** | 58 | Verifisert prod consumer: app/api/backoffice/ai/suggest/route.ts (+2). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts | kode |
| `marketSignals.ts` | **KEEP** | 56 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+2). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx | kode |
| `memory/aiMemory.ts` | **INVESTIGATE** | 162 | Nevnt i strategi/runbook (docs/ai-engine/AI_MEMORY_LEARNING.md) uten prod consumer. | docs/ai-engine/AI_MEMORY_LEARNING.md; docs/ai-engine/AI_MEMORY_LEARNING.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `memory/recordOutcome.ts` | **KEEP** | 137 | Verifisert prod consumer: app/api/backoffice/ai/apply/route.ts (+17). | app/api/backoffice/ai/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-suggestion/log-apply/route.ts; app/api/backoffice/ai/seo-intelligence/route.ts; app/api/backoffice/content/pages/[id]/variant/publish/route.ts; app/api/backoffice/releases/[id]/execute/route.ts (+18) | kode,docs |
| `memoryDecay.ts` | **CUT** | 9 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `menuToIngredients.ts` | **KEEP** | 170 | Pillar 2/ESG-kjerne på live route (200 uten LLM). | app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; docs/audit/lib-ai-decision.md | kode,docs |
| `metrics.ts` | **KEEP** | 60 | Verifisert prod consumer: lib/autopilot/engine.ts (+2). | lib/autopilot/engine.ts; lib/social/analyticsAggregate.ts; app/superadmin/system-graph/SystemGraphClient.tsx; scripts/k6/results/2026-05-23T18-28-55-217Z-summary-export.json; scripts/k6/results/2026-05-23T18-29-43-427Z-summary-export.json; scripts/k6/results/2026-05-23T18-30-11-789Z-summary-export.json (+40) | kode,scheduled |
| `normalizeCmsBlocks.ts` | **KEEP** | 168 | Verifisert prod consumer: lib/hooks/useAiPageBuilder.ts (+2). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts | kode |
| `objectionInsights.ts` | **KEEP** | 28 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+2). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx | kode |
| `operationsFeedback.ts` | **KEEP** | 59 | Pillar 2/ESG-kjerne på live route (200 uten LLM). | app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; docs/audit/lib-ai-decision.md; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `opportunities.ts` | **KEEP** | 144 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+8). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; lib/autopilot/engine.ts; lib/autopilot/index.ts; lib/autopilot/opportunities.ts; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+5) | kode,docs |
| `optimize.ts` | **KEEP** | 65 | Verifisert prod consumer: app/api/backoffice/autonomy/optimize/route.ts (+3). | app/api/backoffice/autonomy/optimize/route.ts; app/api/ai/optimize/route.ts; app/api/backoffice/autonomy/optimize/route.ts; app/api/backoffice/autonomy/optimize/route.ts; scripts/buildTasks.ts; tests/ai/controlLayer.test.ts (+6) | kode,scheduled,tests,cms,docs |
| `optimizer.ts` | **KEEP** | 111 | Verifisert prod consumer: app/api/ai/optimize/route.ts (+4). | app/api/ai/optimize/route.ts; lib/growth/aggregateGrowth.ts; lib/growth/winner.ts; app/api/ai/optimize/route.ts; app/api/ai/optimize/route.ts | kode |
| `orchestration.ts` | **INVESTIGATE** | 150 | Meta-engine root stubs — prod-importer finnes (lib/pos/orchestrator.ts). | lib/pos/orchestrator.ts; lib/pos/orchestrator.ts; lib/pos/orchestrator.ts | kode |
| `outcomeEvaluator.ts` | **CUT** | 23 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `pageBuilder.ts` | **REFACTOR** | 172 | Verifisert prod consumer: lib/moo/generateVariant.ts (+15). | lib/moo/generateVariant.ts; lib/moo/generateVariantsDiverse.ts; app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/api/ai/page/route.ts; lib/hooks/useAiPageBuilder.ts; lib/moo/generateVariant.ts (+19) | kode,docs |
| `pageBuilderPrompts.ts` | **CUT** | 96 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `pageInsightLog.ts` | **KEEP** | 72 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx (+2). | app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx | kode |
| `pageIntent.ts` | **KEEP** | 122 | Verifisert prod consumer: lib/hooks/useAiPageBuilder.ts (+4). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; app/(backoffice)/backoffice/content/_components/contentWorkspaceRightRailSlots.ts; app/(backoffice)/backoffice/content/_components/contentWorkspaceRightRailViewModel.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md (+3) | kode,docs |
| `pageScore.ts` | **KEEP** | 149 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+5). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx | kode |
| `performance.ts` | **KEEP** | 54 | Verifisert prod consumer: lib/revenue/aiRevenueAttribution.ts (+5). | lib/revenue/aiRevenueAttribution.ts; lib/revenue/aiRevenueAttribution.ts; lib/revenue/aiRevenueAttribution.ts; lib/scale/budget.ts; lib/scale/markets.ts; lib/scale/reallocate.ts (+2) | kode,scheduled |
| `policy.ts` | **KEEP** | 22 | Verifisert prod consumer: lib/execution/run.ts (+5). | lib/execution/run.ts; lib/cms/backofficeExtensionRegistry.ts; lib/cms/backofficeSettingsWorkspaceModel.ts; lib/execution/run.ts; lib/execution/run.ts; lib/pos/executionRouter.ts (+1) | kode,docs |
| `policyEngine.ts` | **KEEP** | 199 | Verifisert prod consumer: lib/pos/executionRouter.ts (+4). | lib/pos/executionRouter.ts; lib/autonomy/orchestrator.ts; lib/neural/model.ts; lib/pos/executionRouter.ts; lib/pos/executionRouter.ts; docs/audit/lib-ai-decision.md | kode,docs |
| `portionAllocation.ts` | **KEEP** | 34 | Pillar 2/ESG-kjerne på live route (200 uten LLM). | app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; docs/audit/lib-ai-decision.md; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `pre-evaluate.ts` | **KEEP** | 42 | Verifisert prod consumer: lib/autopilot/engine.ts (+2). | lib/autopilot/engine.ts; lib/autopilot/engine.ts; lib/autopilot/engine.ts | kode |
| `predictiveModel.ts` | **INVESTIGATE** | 42 | Meta-engine root stubs — prod-importer finnes (lib/pipeline/enrichDeal.ts). | lib/pipeline/enrichDeal.ts; lib/pipeline/predict.ts; lib/pipeline/predictAdvanced.ts; lib/pipeline/runPrediction.ts; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `predictiveRiskEngine.ts` | **CUT** | 17 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `predictor.ts` | **INVESTIGATE** | 75 | Meta-engine root stubs — prod-importer finnes (lib/autopilot/engine.ts). | lib/autopilot/engine.ts; lib/autopilot/engine.ts; lib/autopilot/engine.ts | kode |
| `pricing.ts` | **REFACTOR** | 83 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+31). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; lib/autonomy/validator.ts; lib/cms/blocks/blockEditorDataTypes.ts; lib/cms/blocks/blockEntryContract.ts; lib/cms/blocks/blockTypeDefinitions.ts; lib/cms/blockTypeMap.ts (+65) | kode,tests,docs |
| `pricing/engine.ts` | **INVESTIGATE** | 80 | Nevnt i strategi/runbook (docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md) uten prod consumer. | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `prioritization.ts` | **KEEP** | 10 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+5). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx | kode |
| `profit/engine.ts` | **KEEP** | 137 | Verifisert prod consumer: lib/ads/profit.ts (+2). | lib/ads/profit.ts; lib/ads/profitClassifier.ts; lib/ads/profitExecution.ts; tests/ads/profit-first.test.ts | kode,tests |
| `profit/profitState.ts` | **INVESTIGATE** | 61 | Nevnt i strategi/runbook (docs/strategy/phase2-ai-inventory-2026-05-26.md) uten prod consumer. | docs/strategy/phase2-ai-inventory-2026-05-26.md | docs |
| `profitability.ts` | **INVESTIGATE** | 274 | Nevnt i strategi/runbook (docs/strategy/ai-feature-inventory-2026-05-26.md) uten prod consumer. | docs/strategy/ai-feature-inventory-2026-05-26.md | docs |
| `prompts.ts` | **KEEP** | 40 | Verifisert prod consumer: app/api/backoffice/ai/image-generator/route.ts. | app/api/backoffice/ai/image-generator/route.ts; docs/strategy/ai-feature-inventory-2026-05-26.md | kode,docs |
| `rateLimit.ts` | **KEEP** | 104 | Verifisert prod consumer: lib/email/send.ts (+44). | lib/email/send.ts; lib/security/rateLimit.ts; app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cta-improve/route.ts; app/api/backoffice/ai/page-builder/route.ts (+43) | kode,docs |
| `recommendationActions.ts` | **KEEP** | 1028 | Verifisert prod consumer: app/api/ai/recommendation/apply/route.ts (+5). | app/api/ai/recommendation/apply/route.ts; app/api/ai/usage/route.ts; app/api/ai/recommendation/apply/route.ts; app/api/ai/recommendation/apply/route.ts; app/api/ai/usage/route.ts; app/api/ai/usage/route.ts (+1) | kode,docs |
| `recommendations.ts` | **KEEP** | 49 | Verifisert prod consumer: app/api/backoffice/autonomy/recommendations/route.ts (+8). | app/api/backoffice/autonomy/recommendations/route.ts; lib/ceo/buildSnapshot.ts; lib/social/recommendations.ts; app/(backoffice)/backoffice/autonomy/page.tsx; app/api/backoffice/autonomy/recommendations/route.ts; app/api/backoffice/autonomy/recommendations/route.ts (+3) | kode |
| `resolveAiSuggestionFkIds.ts` | **KEEP** | 61 | Verifisert prod consumer: app/api/backoffice/ai/suggest/route.ts (+2). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts | kode |
| `resolveRunnerCompanyForBackoffice.ts` | **KEEP** | 39 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts (+5). | app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/api/auth/me/route.ts; app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/api/auth/me/route.ts; app/api/auth/me/route.ts (+2) | kode,tests |
| `resources/actionCost.ts` | **CUT** | 28 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `resources/capacityEngine.ts` | **CUT** | 42 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `resources/matchEngine.ts` | **CUT** | 19 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `resources/resourceModel.ts` | **INVESTIGATE** | 35 | Scheduled/config consumer (supabase/migrations/20260429260000_ai_memory_resource_allocation_kind.sql) — ikke auto-CUT. | supabase/migrations/20260429260000_ai_memory_resource_allocation_kind.sql; docs/audit/current-menu-architecture.md; docs/audit/tpt-b-7b-hotfix-4.md; docs/strategy/esg-engine-design-2026-05-26.md | scheduled,docs |
| `resources/resourceOrchestrator.ts` | **CUT** | 26 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `resources/scheduler.ts` | **CUT** | 15 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `responseSafety.ts` | **KEEP** | 142 | Verifisert prod consumer: app/api/backoffice/ai/block-builder/route.ts (+26). | app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cta-improve/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/image-metadata/route.ts; app/api/backoffice/ai/layout-suggestions/route.ts (+21) | kode |
| `retention/engine.ts` | **INVESTIGATE** | 62 | Nevnt i strategi/runbook (docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md) uten prod consumer. | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `revenue/analyzePerformance.ts` | **KEEP** | 143 | Verifisert prod consumer: app/api/backoffice/revenue/insights/route.ts (+2). | app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts | kode |
| `revenue/applyRevenueActions.ts` | **KEEP** | 79 | Verifisert prod consumer: app/api/backoffice/revenue/insights/route.ts (+2). | app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts | kode |
| `revenue/attribution.ts` | **CUT** | 108 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `revenue/decisionEngine.ts` | **KEEP** | 94 | Verifisert prod consumer: app/api/backoffice/revenue/insights/route.ts (+5). | app/api/backoffice/revenue/insights/route.ts; tests/ai/revenue/decisionEngine.test.ts; lib/revenue/actions.ts; lib/revenue/optimize.ts; app/(backoffice)/backoffice/content/_components/EditorRevenueInsightsPanel.tsx; app/api/backoffice/revenue/insights/route.ts (+3) | kode,tests |
| `revenue/policy.ts` | **KEEP** | 75 | Verifisert prod consumer: app/api/backoffice/revenue/insights/route.ts (+2). | app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts | kode |
| `rewrite.ts` | **KEEP** | 61 | Verifisert prod consumer: app/api/ai/rewrite/route.ts (+8). | app/api/ai/rewrite/route.ts; app/(backoffice)/backoffice/ai/editor-verification/page.tsx; app/(backoffice)/backoffice/content/_components/BlockInspectorShell.tsx; app/(backoffice)/backoffice/content/_components/InlineAiActions.tsx; app/(backoffice)/backoffice/content/_components/useContentWorkspaceRichTextAi.ts; app/api/ai/rewrite/route.ts (+10) | kode,scheduled,tests,docs |
| `roadmapEngine.ts` | **INVESTIGATE** | 34 | Meta-engine root stubs — prod-importer finnes (lib/strategy/roadmap.ts). | lib/strategy/roadmap.ts; lib/strategy/run.ts | kode |
| `role.ts` | **KEEP** | 23 | Prod consumer på live P2-route (app/api/kitchen/demand-forecast/route.ts). | lib/growth/growthAttributionInsights.ts; lib/leads/createLead.ts; lib/leads/types.ts; lib/outbound/normalizeSegment.ts; lib/social/attribution.ts; lib/social/b2bLeadMessaging.ts (+65) | kode,scheduled,tests,cms |
| `run.ts` | **KEEP** | 88 | Verifisert prod consumer: lib/acquire/strategy.ts (+40). | lib/acquire/strategy.ts; lib/exit/outreach.ts; lib/exit/strategy.ts; lib/market/dominate.ts; lib/market/domination.ts; lib/market/message.ts (+48) | kode,scheduled,tests,docs |
| `runner.ts` | **REFACTOR** | 569 | Verifisert prod consumer: lib/sales/messageGenerator.ts (+46). | lib/sales/messageGenerator.ts; app/api/ai/block/route.ts; app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/capability/route.ts; app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cta-improve/route.ts (+68) | kode,scheduled,tests,docs |
| `runnerGovernance.ts` | **REFACTOR** | 382 | Verifisert prod consumer: app/api/ai/business-engine/route.ts (+8). | app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/ai/business-engine/route.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts (+5) | kode,tests |
| `safeApply.ts` | **KEEP** | 57 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx (+2). | app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx | kode |
| `safety/aiSafetyFilter.ts` | **KEEP** | 156 | Verifisert prod consumer: app/api/system/ai/diagnostics/route.ts (+2). | app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `schema/errors.ts` | **KEEP** | 52 | Verifisert prod consumer: app/api/backoffice/ai/design-optimizer/apply/route.ts (+11). | app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/intelligence/events/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/revenue/insights/route.ts; tests/ai/schema.test.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts (+9) | kode,tests |
| `schema/events.ts` | **KEEP** | 46 | Verifisert prod consumer: app/api/backoffice/ai/intelligence/events/route.ts. | app/api/backoffice/ai/intelligence/events/route.ts | kode |
| `schema/index.ts` | **CUT** | 45 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `schema/payloads.ts` | **CUT** | 275 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `schema/schemaRef.ts` | **CUT** | 9 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `schema/validate.ts` | **INVESTIGATE** | 218 | Kun test-consumers (3) — test-only/legacy. | tests/ai/schema.test.ts; tests/ai/schema.test.ts; tests/ai/schema.test.ts | tests |
| `segmentation/engine.ts` | **CUT** | 88 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `seoAnalyzer.ts` | **CUT** | 159 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `seoEngine.ts` | **KEEP** | 142 | Verifisert prod consumer: app/api/ai/growth/seo/route.ts (+2). | app/api/ai/growth/seo/route.ts; app/api/ai/growth/seo/route.ts; app/api/ai/growth/seo/route.ts; docs/phase2d/SEO_SOURCE_OF_TRUTH.md | kode,docs |
| `signalEngine.ts` | **KEEP** | 18 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx. | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx | kode |
| `signals.ts` | **KEEP** | 62 | Verifisert prod consumer: lib/pitch/data.ts (+7). | lib/pitch/data.ts; app/api/backoffice/control-tower/route.ts; lib/pitch/data.ts; lib/pitch/data.ts; lib/pos/index.ts; lib/pos/signalCollector.ts (+2) | kode |
| `simulator.ts` | **KEEP** | 59 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+2). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx | kode |
| `siteAnalysis.ts` | **KEEP** | 122 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+5). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx | kode |
| `siteGrowthLog.ts` | **KEEP** | 32 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx (+2). | app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx | kode |
| `socialStrategy.ts` | **KEEP** | 42 | Verifisert prod consumer: lib/forecast/controlTowerPlan.ts (+74). | lib/forecast/controlTowerPlan.ts; lib/pricing/superadminViews.ts; lib/procurement/plan.ts; lib/product/adCampaignEconomicsGate.ts; lib/product/growthProductViews.ts; lib/product/socialRefEconomics.ts (+78) | kode,tests |
| `strategicCeoDecision.ts` | **INVESTIGATE** | 30 | Meta-engine root stubs — prod-importer finnes (lib/autopilot/engine.ts). | lib/autopilot/engine.ts; lib/autopilot/engine.ts; lib/autopilot/engine.ts | kode |
| `strategicContext.ts` | **CUT** | 76 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `strategicPrioritizer.ts` | **CUT** | 20 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `strategyEngine.ts` | **KEEP** | 264 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+6). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; lib/acquire/strategy.ts; lib/strategy/actions.ts; lib/strategy/run.ts; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+1) | kode |
| `strictBlockValidator.ts` | **CUT** | 83 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `suggestMotor.ts` | **KEEP** | 391 | Verifisert prod consumer: app/api/backoffice/ai/suggest/route.ts (+2). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; docs/ai-editor/verification-map-and-status.md; docs/ai-editor/verification-map-and-status.md; docs/audit/lib-ai-decision.md | kode,docs |
| `systemState.ts` | **CUT** | 35 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `tools/abGenerateVariants.ts` | **INVESTIGATE** | 257 | Nevnt i strategi/runbook (docs/ai-engine/EXPERIMENT_CRO_FLOW.md) uten prod consumer. | docs/ai-engine/EXPERIMENT_CRO_FLOW.md; docs/ai-engine/EXPERIMENT_CRO_FLOW.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `tools/blockBuilder.ts` | **KEEP** | 186 | Verifisert prod consumer: app/api/backoffice/ai/block-builder/route.ts (+5). | app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/screenshot-builder/route.ts; app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/screenshot-builder/route.ts; app/api/backoffice/ai/screenshot-builder/route.ts (+5) | kode,tests,docs |
| `tools/contentMaintainPage.ts` | **INVESTIGATE** | 257 | Nevnt i strategi/runbook (docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md) uten prod consumer. | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `tools/imageGenerateBrandSafe.ts` | **KEEP** | 74 | Verifisert prod consumer: app/api/backoffice/ai/image-generator/route.ts (+2). | app/api/backoffice/ai/image-generator/route.ts; app/api/backoffice/ai/image-generator/route.ts; app/api/backoffice/ai/image-generator/route.ts; tests/api/backofficeAiImageRoutes.test.ts; tests/api/backofficeAiImageRoutes.test.ts; docs/backoffice/CMS_EDITOR_AUDIT_AND_ARCHITECTURE.md (+8) | kode,tests,docs |
| `tools/imageImproveMetadata.ts` | **KEEP** | 100 | Verifisert prod consumer: app/api/backoffice/ai/image-metadata/route.ts (+2). | app/api/backoffice/ai/image-metadata/route.ts; app/api/backoffice/ai/image-metadata/route.ts; app/api/backoffice/ai/image-metadata/route.ts; tests/api/backofficeAiImageRoutes.test.ts; tests/api/backofficeAiImageRoutes.test.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md (+1) | kode,tests,docs |
| `tools/landingGenerateSections.ts` | **INVESTIGATE** | 159 | Nevnt i strategi/runbook (docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md) uten prod consumer. | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `tools/layoutSuggestions.ts` | **KEEP** | 320 | Verifisert prod consumer: app/api/backoffice/ai/layout-suggestions/route.ts (+2). | app/api/backoffice/ai/layout-suggestions/route.ts; app/api/backoffice/ai/layout-suggestions/route.ts; app/api/backoffice/ai/layout-suggestions/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md; docs/reports/PLATFORM_100_PERCENT_REPORT.md (+1) | kode,docs |
| `tools/pageBuilder.ts` | **KEEP** | 292 | Verifisert prod consumer: app/api/backoffice/ai/page-builder/route.ts (+4). | app/api/backoffice/ai/page-builder/route.ts; tests/ai/pageBuilderDraft.test.ts; tests/ai/providerFallback.test.ts; tests/lib/ai/pageBuilder.test.ts; app/(backoffice)/backoffice/content/_components/editorAiContracts.ts; app/(backoffice)/backoffice/content/_components/EDITOR_AI_CONTRACT_MODEL.md (+17) | kode,tests,docs |
| `tools/registry.ts` | **KEEP** | 120 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/contentWorkspace.ai.ts (+12). | app/(backoffice)/backoffice/content/_components/contentWorkspace.ai.ts; app/api/backoffice/ai/suggest/route.ts; app/api/system/ai/diagnostics/route.ts; app/api/system/ai/health/route.ts; tests/ai/seoToolPolicy.test.ts; app/(backoffice)/backoffice/content/_components/contentWorkspace.ai.ts (+15) | kode,tests,docs |
| `tools/seoOptimizePage.ts` | **INVESTIGATE** | 162 | Nevnt i strategi/runbook (docs/FULL_REPOSITORY_AUDIT_VERIFIED.md) uten prod consumer. | docs/FULL_REPOSITORY_AUDIT_VERIFIED.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md; docs/reports/PLATFORM_100_PERCENT_REPORT.md; docs/reports/PLATFORM_100_PERCENT_REPORT.md | docs |
| `tools/translateBlocks.ts` | **INVESTIGATE** | 143 | Nevnt i strategi/runbook (docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md) uten prod consumer. | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `tracking.ts` | **KEEP** | 81 | Verifisert prod consumer: app/api/ai/track/route.ts (+2). | app/api/ai/track/route.ts; app/api/ai/track/route.ts; app/api/ai/track/route.ts | kode |
| `transientAiJsonCache.ts` | **CUT** | 46 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `types.ts` | **KEEP** | 93 | Verifisert prod consumer: lib/pos/signalCollector.ts (+4). | lib/pos/signalCollector.ts; app/api/ai/copilot/route.ts; lib/pos/signalCollector.ts; app/api/ai/copilot/route.ts; app/api/ai/copilot/route.ts; scripts/seed/tsconfig.json | kode,scheduled |
| `usage.ts` | **KEEP** | 229 | Verifisert prod consumer: app/api/ai/usage/route.ts (+6). | app/api/ai/usage/route.ts; lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; app/api/ai/usage/route.ts; docs/strategy/ai-feature-inventory-2026-05-26.md (+7) | kode,docs |
| `usageOverview.ts` | **KEEP** | 273 | Verifisert prod consumer: lib/pos/signalCollector.ts (+8). | lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; lib/pos/signalCollector.ts; lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts (+3) | kode |
| `validate.ts` | **KEEP** | 62 | Verifisert prod consumer: app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx (+1). | app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx; app/api/backoffice/ai/cms-menu/route.ts; scripts/validate.ts; docs/strategy/ai-feature-inventory-2026-05-26.md | kode,scheduled,docs |
| `validateComponentOutput.ts` | **CUT** | 82 | Full repo crawl: 0 eksterne consumers (import/path/export/route/cron/docs-runbook) — kun lib/ai-intern eller manifest. | ingen | ingen-ekstern |
| `validation/validateAiOutput.ts` | **KEEP** | 203 | Verifisert prod consumer: app/api/system/ai/diagnostics/route.ts (+2). | app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md (+1) | kode,docs |
| `variantGenerator.ts` | **KEEP** | 145 | Verifisert prod consumer: lib/content/variants.ts (+2). | lib/content/variants.ts; lib/growth/domination.ts; lib/social/abGenerator.ts | kode |
| `wasteTracker.ts` | **REFACTOR** | 98 | Pillar 2/ESG-kjerne på live route (200 uten LLM). | app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts; docs/audit/lib-ai-decision.md; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/esg-engine-design-2026-05-26.md (+2) | kode,docs |

---

## CUT-grupperinger (Fase B atomisk sletting)

### orphan-unverified (`orphan-unverified`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 29 | 2248 | L (split) |

**Filer:** `actions/mapDecisionToAction.ts`, `audience.ts`, `cmsAiPrompts.ts`, `cmsAiTypes.ts`, `conversion/engine.ts`, `decisionId.ts`, `design/suggestDesignImprovements.ts`, `enrichPageBuilderBlocks.ts`, `entitlements.ts`, `evaluator.ts`, `events/triggers.ts`, `evolve.ts`, `experiments/revenueExperimentHints.ts`, `governanceApplySafety.ts`, `governor.ts`, `insightsEngine.ts`, `learningBySurface.ts`, `pageBuilderPrompts.ts`, `revenue/attribution.ts`, `schema/index.ts`, `schema/payloads.ts`, `schema/schemaRef.ts`, `segmentation/engine.ts`, `seoAnalyzer.ts`, `strategicContext.ts`, `strictBlockValidator.ts`, `systemState.ts`, `transientAiJsonCache.ts`, `validateComponentOutput.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

### Intelligence meta (`intelligence-meta`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 6 | 879 | M (1–2 PR) |

**Filer:** `intelligence/confidence.ts`, `intelligence/patterns.ts`, `intelligence/scaleDecision.ts`, `intelligence/scalePolicy.ts`, `intelligence/signals.ts`, `intelligence/trends.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

### Company meta-engine (`company-meta`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 4 | 314 | S (1 PR) |

**Filer:** `company/actionTypes.ts`, `company/anomaly.ts`, `company/decisionEngine.ts`, `company/safety.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

### CEO / autonomy meta (`ceo-autonomy-meta`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 5 | 256 | S (1 PR) |

**Filer:** `autonomy/automationLayer.ts`, `autonomy/autonomyLearning.ts`, `autonomy/autonomyPolicy.ts`, `autonomy/collectDecisions.ts`, `ceo/learning.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

### Capital / allocation (Pillar 1) (`capital-allocation-stubs`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 9 | 246 | S (1 PR) |

**Filer:** `capital/actionPriority.ts`, `capital/allocationEngine.ts`, `capital/capitalOutput.ts`, `capital/capitalState.ts`, `capital/executionEngine.ts`, `capital/executionPlan.ts`, `capital/investmentAreas.ts`, `capital/riskEngine.ts`, `capital/roiEngine.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

### Meta-engine root stubs (`meta-engines-root`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 5 | 134 | S (1 PR) |

**Filer:** `experienceModel.ts`, `memoryDecay.ts`, `outcomeEvaluator.ts`, `predictiveRiskEngine.ts`, `strategicPrioritizer.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

### Resource orchestration (`resources-orchestration-stubs`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 5 | 130 | S (1 PR) |

**Filer:** `resources/actionCost.ts`, `resources/capacityEngine.ts`, `resources/matchEngine.ts`, `resources/resourceOrchestrator.ts`, `resources/scheduler.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

### Agent swarm (`agents-swarm`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 5 | 127 | S (1 PR) |

**Filer:** `agents/ceoAgent.ts`, `agents/cmoAgent.ts`, `agents/cooAgent.ts`, `agents/ctoAgent.ts`, `agents/index.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

### Attribution ROI orphans (`attribution-roi-stubs`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 3 | 122 | S (1 PR) |

**Filer:** `attribution/aggregationEngine.ts`, `attribution/insightEngine.ts`, `attribution/roiEngine.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

### control/* (kun test-consumers) (`control-test-only`)

| Filer | LOC | Est. PR-size |
|-------|----:|-------------|
| 2 | 31 | S (1 PR) |

**Filer:** `control/normalizeControlType.ts`, `control/overrideEngine.ts`

**Blast radius:** Ingen prod consumers verifisert i full crawl.

**Tester re-run:** `npm run test:run` (ingen direkte test-treff)

**Smoke post-merge:** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, backoffice AI capability

---

## REFACTOR-kandidater (Phase 3+, ikke action nå)

| Fil | LOC | Hva trenger oppstramming |
|-----|----:|--------------------------|
| `anomaly.ts` | 52 | Ikke koblet til kunde-SLA. |
| `cmsAiEngine.ts` | 278 | Strict block-validering på hver LLM-respons. |
| `demandEngine.ts` | 224 | V1 live; ML Layer 3 utsatt. |
| `demandInsights.ts` | 114 | Dish signals live; ingen CO₂-vekt. |
| `editorRewrite.ts` | 88 | Brukes av AiTextAssistPopover — vurder merge med editorTextSuggest. |
| `editorTextSuggest.ts` | 85 | Align med responseSafety. |
| `experiment.ts` | 77 | Verifiser tenant-isolasjon på queries. |
| `pageBuilder.ts` | 172 | Høy tokenflate — cap blocks. |
| `pricing.ts` | 83 | 10% heuristikk — ikke avtale-koblet. |
| `runner.ts` | 569 | Timeout, Redis rate limit, PII-scrub (P2-4). |
| `runnerGovernance.ts` | 382 | Profitability-gate ikke enterprise-hardened. |
| `wasteTracker.ts` | 98 | ESG rollup fail-closed på produced:null — trenger produksjonsqty. |

---

## INVESTIGATE — krever Thomas's beslutning

| Fil | LOC | Spørsmål |
|-----|----:|----------|
| `_internalProvider.ts` | 500 | `_internalProvider.ts` referert fra scheduled/config (`scripts/check-ai-internal-provider.mjs`). Aktiv cron med business-verdi, eller død referanse? |
| `adaptiveScoring.ts` | 131 | `adaptiveScoring.ts` nevnt i `docs/strategy/phase2-ai-inventory-2026-05-26.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `analysis/contentHealth.ts` | 72 | `analysis/contentHealth.ts` — uklar status etter consumer-graph. Manuel review? |
| `autonomy/autonomyAttribution.ts` | 39 | Filen `autonomy/autonomyAttribution.ts` importeres av `app/api/backoffice/autonomy/feedback/route.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `autonomy/autonomyLog.ts` | 60 | Filen `autonomy/autonomyLog.ts` importeres av `app/(backoffice)/backoffice/ai-control/page.tsx` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `autonomy/runner.ts` | 137 | Filen `autonomy/runner.ts` importeres av `app/api/backoffice/autonomy/run/route.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `autonomy/types.ts` | 50 | Filen `autonomy/types.ts` importeres av `app/api/backoffice/autonomy/feedback/route.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `autonomyController.ts` | 65 | Filen `autonomyController.ts` importeres av `lib/autonomy/config.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `capital/actionGenerator.ts` | 23 | Filen `capital/actionGenerator.ts` importeres av `lib/autonomy/engine.ts` men ligger i CUT-gruppe «Capital / allocation (Pillar 1)». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `ceo/attribution.ts` | 36 | Filen `ceo/attribution.ts` importeres av `app/api/backoffice/ceo/feedback/route.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `ceo/automationEngine.ts` | 63 | Filen `ceo/automationEngine.ts` importeres av `app/api/pipeline/actions/route.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `ceo/ceoLog.ts` | 55 | Filen `ceo/ceoLog.ts` importeres av `app/(backoffice)/backoffice/control/page.tsx` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `ceo/decisionEngine.ts` | 169 | Filen `ceo/decisionEngine.ts` importeres av `app/api/backoffice/ceo/recommendations/route.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `ceo/growthEngine.ts` | 53 | Filen `ceo/growthEngine.ts` importeres av `app/api/backoffice/ceo/recommendations/route.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `ceo/policyEngine.ts` | 51 | Filen `ceo/policyEngine.ts` importeres av `lib/autonomy/execute.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `ceo/runner.ts` | 131 | Filen `ceo/runner.ts` importeres av `app/api/backoffice/ceo/run/route.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `ceo/types.ts` | 66 | Filen `ceo/types.ts` importeres av `app/api/backoffice/ceo/feedback/route.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `ceoExecutor.ts` | 27 | Filen `ceoExecutor.ts` importeres av `lib/autopilot/engine.ts` men ligger i CUT-gruppe «CEO / autonomy meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `company/automationEngine.ts` | 178 | Filen `company/automationEngine.ts` importeres av `app/api/backoffice/company/control-tower/route.ts` men ligger i CUT-gruppe «Company meta-engine». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `company/memory.ts` | 48 | Filen `company/memory.ts` importeres av `app/api/backoffice/company/control-tower/route.ts` men ligger i CUT-gruppe «Company meta-engine». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `company/policyEngine.ts` | 244 | Filen `company/policyEngine.ts` importeres av `app/api/backoffice/company/control-tower/route.ts` men ligger i CUT-gruppe «Company meta-engine». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `company/types.ts` | 106 | Filen `company/types.ts` importeres av `app/api/backoffice/company/control-tower/route.ts` men ligger i CUT-gruppe «Company meta-engine». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `control/controlGate.ts` | 49 | `control/controlGate.ts` har 3 test-consumer(s) og 0 prod. Slette tester + CUT filen, eller beholde som fremtidig kontrakt? |
| `control/ethicsEngine.ts` | 15 | `control/ethicsEngine.ts` har 3 test-consumer(s) og 0 prod. Slette tester + CUT filen, eller beholde som fremtidig kontrakt? |
| `control/explainEngine.ts` | 18 | `control/explainEngine.ts` har 3 test-consumer(s) og 0 prod. Slette tester + CUT filen, eller beholde som fremtidig kontrakt? |
| `control/killSwitch.ts` | 11 | `control/killSwitch.ts` — uklar status etter consumer-graph. Manuel review? |
| `controlTower/actionRegistry.ts` | 25 | Filen `controlTower/actionRegistry.ts` importeres av `app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts` men ligger i CUT-gruppe «Control-tower meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `controlTower/controlExecutor.ts` | 109 | Filen `controlTower/controlExecutor.ts` importeres av `app/api/control-tower/route.ts` men ligger i CUT-gruppe «Control-tower meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `croAnalyzer.ts` | 97 | `croAnalyzer.ts` nevnt i `docs/strategy/phase2-ai-inventory-2026-05-26.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `crossSurfaceLearning.ts` | 44 | Filen `crossSurfaceLearning.ts` importeres av `lib/pos/crossSurfaceLearning.ts` men ligger i CUT-gruppe «Meta-engine root stubs». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `design/types.ts` | 55 | `design/types.ts` har 2 test-consumer(s) og 0 prod. Slette tester + CUT filen, eller beholde som fremtidig kontrakt? |
| `experimentGenerator.ts` | 29 | Filen `experimentGenerator.ts` importeres av `lib/experiments/createHomeTrafficExperimentCore.ts` men ligger i CUT-gruppe «Meta-engine root stubs». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `intelligence/index.ts` | 98 | Filen `intelligence/index.ts` importeres av `app/api/ai/decision/route.ts` men ligger i CUT-gruppe «Intelligence meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `intelligence/learning.ts` | 73 | Filen `intelligence/learning.ts` importeres av `app/api/backoffice/ai/design-optimizer/apply/route.ts` men ligger i CUT-gruppe «Intelligence meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `intelligence/query.ts` | 89 | Filen `intelligence/query.ts` importeres av `app/api/backoffice/ai/intelligence/query/route.ts` men ligger i CUT-gruppe «Intelligence meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `intelligence/scale.ts` | 291 | Filen `intelligence/scale.ts` importeres av `lib/growth/scale-engine.ts` men ligger i CUT-gruppe «Intelligence meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `intelligence/scaleApply.ts` | 270 | Filen `intelligence/scaleApply.ts` importeres av `app/api/backoffice/company/control-tower/route.ts` men ligger i CUT-gruppe «Intelligence meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `intelligence/store.ts` | 217 | Filen `intelligence/store.ts` importeres av `lib/observability/eventLogger.ts` men ligger i CUT-gruppe «Intelligence meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `intelligence/systemIntelligence.ts` | 71 | Filen `intelligence/systemIntelligence.ts` importeres av `app/api/ai/decision/route.ts` men ligger i CUT-gruppe «Intelligence meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `intelligence/types.ts` | 80 | Filen `intelligence/types.ts` importeres av `app/(backoffice)/backoffice/intelligence/page.tsx` men ligger i CUT-gruppe «Intelligence meta». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `jobs/backoff.ts` | 12 | `jobs/backoff.ts` nevnt i `docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `jobs/claim.ts` | 49 | `jobs/claim.ts` nevnt i `docs/db-cleanup-report.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `keywords.ts` | 41 | `keywords.ts` koblet til CMS-felt i `studio/lunchportalen-studio/package.json`. Skal AI-fylling implementeres (P2), eller doc-only? |
| `memory/aiMemory.ts` | 162 | `memory/aiMemory.ts` nevnt i `docs/ai-engine/AI_MEMORY_LEARNING.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `orchestration.ts` | 150 | Filen `orchestration.ts` importeres av `lib/pos/orchestrator.ts` men ligger i CUT-gruppe «Meta-engine root stubs». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `predictiveModel.ts` | 42 | Filen `predictiveModel.ts` importeres av `lib/pipeline/enrichDeal.ts` men ligger i CUT-gruppe «Meta-engine root stubs». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `predictor.ts` | 75 | Filen `predictor.ts` importeres av `lib/autopilot/engine.ts` men ligger i CUT-gruppe «Meta-engine root stubs». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `pricing/engine.ts` | 80 | `pricing/engine.ts` nevnt i `docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `profit/profitState.ts` | 61 | `profit/profitState.ts` nevnt i `docs/strategy/phase2-ai-inventory-2026-05-26.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `profitability.ts` | 274 | `profitability.ts` nevnt i `docs/strategy/ai-feature-inventory-2026-05-26.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `resources/resourceModel.ts` | 35 | `resources/resourceModel.ts` referert fra scheduled/config (`supabase/migrations/20260429260000_ai_memory_resource_alloca`). Aktiv cron med business-verdi, eller død referanse? |
| `retention/engine.ts` | 62 | `retention/engine.ts` nevnt i `docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `roadmapEngine.ts` | 34 | Filen `roadmapEngine.ts` importeres av `lib/strategy/roadmap.ts` men ligger i CUT-gruppe «Meta-engine root stubs». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `schema/validate.ts` | 218 | `schema/validate.ts` har 3 test-consumer(s) og 0 prod. Slette tester + CUT filen, eller beholde som fremtidig kontrakt? |
| `strategicCeoDecision.ts` | 30 | Filen `strategicCeoDecision.ts` importeres av `lib/autopilot/engine.ts` men ligger i CUT-gruppe «Meta-engine root stubs». Skal importerende route fjernes først (Phase B), eller beholdes som Pillar 1 defer? |
| `tools/abGenerateVariants.ts` | 257 | `tools/abGenerateVariants.ts` nevnt i `docs/ai-engine/EXPERIMENT_CRO_FLOW.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `tools/contentMaintainPage.ts` | 257 | `tools/contentMaintainPage.ts` nevnt i `docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `tools/landingGenerateSections.ts` | 159 | `tools/landingGenerateSections.ts` nevnt i `docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `tools/seoOptimizePage.ts` | 162 | `tools/seoOptimizePage.ts` nevnt i `docs/FULL_REPOSITORY_AUDIT_VERIFIED.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |
| `tools/translateBlocks.ts` | 143 | `tools/translateBlocks.ts` nevnt i `docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md`. Planlagt feature eller død referanse? Hvis død: oppdatere doc + CUT? |

---

## Crawl-funn utenfor lib/ai/

- `attribution/storeAttribution.ts` ← `components/revenue/AttributionCapture.tsx` (components/)
- `billing.ts` ← superadmin route `app/api/superadmin/companies/[companyId]/invoice-basis/route.ts`
- `billing.ts` ← `components/providers/ProviderNav.tsx` (components/)
- `dashboard.ts` ← `components/ai-motor/AiMotorDemoShared.tsx` (components/)
- `debounce.ts` ← `components/superadmin/FirmsTable.tsx` (components/)
- `editorRewrite.ts` ← `components/cms/AiTextAssistPopover.tsx` (components/)
- `experiment.ts` ← superadmin route `app/api/superadmin/experiments/route.ts`
- `experiments/aiExperimentsRepo.ts` ← superadmin route `app/api/superadmin/experiments/route.ts`
- `image.ts` ← `components/blocks/EnterpriseLockedBlockView.tsx` (components/)
- `image.ts` ← `components/blocks/MarketingImageBlock.tsx` (components/)
- `image.ts` ← `components/blocks/TestimonialBlock.tsx` (components/)
- `image.ts` ← `components/cms/blockCanvas/frames/DefaultCanvasFrame.tsx` (components/)
- `inline.ts` ← `components/cms/blockCanvas/frames/CardsCanvasFrame.tsx` (components/)
- `inline.ts` ← `components/cms/blockCanvas/frames/CtaCanvasFrame.tsx` (components/)
- `inline.ts` ← `components/cms/blockCanvas/frames/DefaultCanvasFrame.tsx` (components/)
- `inline.ts` ← `components/cms/blockCanvas/frames/GridCanvasFrame.tsx` (components/)
- `inline.ts` ← `components/cms/blockCanvas/frames/HeroCanvasFrame.tsx` (components/)
- `inline.ts` ← `components/cms/blockCanvas/frames/PricingCanvasFrame.tsx` (components/)
- `inline.ts` ← `components/cms/blockCanvas/frames/RelatedCanvasFrame.tsx` (components/)
- `inline.ts` ← `components/cms/blockCanvas/frames/StepsCanvasFrame.tsx` (components/)
- `inline.ts` ← `components/cms/BlockToolbar.tsx` (components/)
- `logging/aiExecutionLog.ts` ← superadmin route `app/api/superadmin/control-tower/autopilot/route.ts`
- `logging/aiExecutionLog.ts` ← superadmin route `app/api/superadmin/control-tower/scale/route.ts`
- `pricing.ts` ← `components/cms/blockCanvas/frames/PricingCanvasFrame.tsx` (components/)
- `pricing.ts` ← `components/cms/blockCanvas/PricingCanvasPreview.tsx` (components/)
- `pricing.ts` ← `components/cms/CmsBlockRenderer.tsx` (components/)
- `pricing.ts` ← `components/cms/HomePricingSection.tsx` (components/)
- `role.ts` ← superadmin route `app/api/superadmin/firms/[companyId]/employees/route.ts`
- `role.ts` ← superadmin route `app/api/superadmin/menus-week/route.ts`
- `role.ts` ← superadmin route `app/api/superadmin/system/flow/diagnostics/route.ts`
- `role.ts` ← superadmin route `app/api/superadmin/user-disable/route.ts`
- `role.ts` ← superadmin route `app/api/superadmin/user-role/route.ts`
- `role.ts` ← superadmin route `app/api/superadmin/users/route.ts`
- `role.ts` ← superadmin route `app/api/superadmin/users/set-scope/route.ts`
- Sanity `mealIdea.aiMenuLearning` — schema forventer AI-scorer (ikke lib/ai-import).
- Ingen `app/api/cron/*` importerer `@/lib/ai/*` (vercel crons ikke AI-koblet direkte).
- Umbraco views: 0 treff på `/api/ai` (ingen Razor AI-kall).
- `app/api/superadmin/control-tower/snapshot` kaller `/api/social/ai` server-side.

---

## app/api/ai/** — route classification

| Route | Class | LOC | Justification | UI/docs consumers |
|-------|-------|----:|---------------|-------------------|
| `app/api/ai/analyze/route.ts` | **INVESTIGATE** | 88 | Ingen UI-fetch funnet i crawl. | app/api/ai/insights/route.ts; app/api/ai/learn/route.ts; scripts/smoke/dc-011-smoke.mjs; scripts/smoke/forensics-4.5c.mjs; tests/security/ai-routes-auth.test.ts |
| `app/api/ai/block/route.ts` | **INVESTIGATE** | 177 | Ingen UI-fetch funnet i crawl. | lib/ai/logActivity.ts; app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts; app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md |
| `app/api/ai/block/score/route.ts` | **INVESTIGATE** | 49 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md; docs/operations/api-auth-inventory.md |
| `app/api/ai/business-engine/route.ts` | **CUT** | 154 | Pillar 1 growth — docs refererer men ingen prod UI-fetch i crawl. | lib/ai/runnerGovernance.ts; app/(backoffice)/backoffice/ai/overview/page.tsx; app/api/ai/business-engine/route.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md |
| `app/api/ai/continue/route.ts` | **INVESTIGATE** | 67 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/full-system/IMPLEMENTATION_LOG.md |
| `app/api/ai/copilot/route.ts` | **CUT** | 73 | Pillar 1 growth — docs refererer men ingen prod UI-fetch i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceCopilot.ts; scripts/smoke/dc-011-smoke.mjs; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md |
| `app/api/ai/dashboard/route.ts` | **INVESTIGATE** | 84 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts; app/api/ai/dashboard/route.ts; scripts/smoke/dc-011-prod-smoke.mjs; scripts/smoke/dc-011-smoke.mjs; scripts/smoke/forensics-4.5c.mjs |
| `app/api/ai/decision/route.ts` | **INVESTIGATE** | 134 | Ingen UI-fetch funnet i crawl. | tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md; docs/operations/api-auth-inventory.md |
| `app/api/ai/design/analyze/route.ts` | **INVESTIGATE** | 90 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceDesignAi.ts; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/full-system/IMPLEMENTATION_LOG.md |
| `app/api/ai/design/generate/route.ts` | **INVESTIGATE** | 83 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceDesignAi.ts; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/full-system/IMPLEMENTATION_LOG.md |
| `app/api/ai/experiments/route.ts` | **INVESTIGATE** | 91 | Ingen UI-fetch funnet i crawl. | lib/system/controlCoverage.ts; scripts/verify-control-coverage.mjs; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md |
| `app/api/ai/generate/route.ts` | **INVESTIGATE** | 110 | Ingen UI-fetch funnet i crawl. | lib/hooks/useAiPageBuilder.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md; docs/operations/api-auth-inventory.md |
| `app/api/ai/growth/ads/route.ts` | **CUT** | 78 | Pillar 1 growth — docs refererer men ingen prod UI-fetch i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md |
| `app/api/ai/growth/funnel/route.ts` | **CUT** | 108 | Pillar 1 growth — docs refererer men ingen prod UI-fetch i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md |
| `app/api/ai/growth/seo/route.ts` | **CUT** | 107 | Pillar 1 growth — docs refererer men ingen prod UI-fetch i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/full-system/IMPLEMENTATION_LOG.md |
| `app/api/ai/image/route.ts` | **INVESTIGATE** | 67 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md; docs/operations/api-auth-inventory.md |
| `app/api/ai/inline/route.ts` | **INVESTIGATE** | 69 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/full-system/IMPLEMENTATION_LOG.md |
| `app/api/ai/insights/route.ts` | **INVESTIGATE** | 81 | Ingen UI-fetch funnet i crawl. | scripts/smoke/dc-011-smoke.mjs; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md |
| `app/api/ai/layout/route.ts` | **INVESTIGATE** | 71 | Ingen UI-fetch funnet i crawl. | lib/ai/pageIntent.ts; lib/hooks/useAiPageBuilder.ts; app/(backoffice)/backoffice/content/_components/contentWorkspace.ai.ts; app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts; docs/audit/02-file-manifest.json |
| `app/api/ai/learn/route.ts` | **INVESTIGATE** | 69 | Ingen UI-fetch funnet i crawl. | tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md; docs/operations/api-auth-inventory.md |
| `app/api/ai/optimize/route.ts` | **INVESTIGATE** | 95 | Ingen UI-fetch funnet i crawl. | docs/audit/02-file-manifest.json; docs/audit/current-menu-architecture.md; docs/audit/parts/06b-paths-app.md; docs/operations/api-auth-inventory.md; docs/repo-audit/U00R2_FULL_FOLDER_CLASSIFICATION.md |
| `app/api/ai/page/audit/route.ts` | **INVESTIGATE** | 76 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json; docs/audit/parts/06b-paths-app.md; docs/operations/api-auth-inventory.md |
| `app/api/ai/page/route.ts` | **INVESTIGATE** | 71 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/content/_components/contentWorkspace.ai.ts; app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts; app/api/ai/route.ts; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json |
| `app/api/ai/recommendation/apply/route.ts` | **INVESTIGATE** | 102 | Ingen UI-fetch funnet i crawl. | lib/ai/dashboardEngine.ts; app/(backoffice)/backoffice/ai/overview/page.tsx; app/api/ai/recommendation/apply/route.ts; supabase/migrations/20260427120000_ai_runner_governance.sql; docs/audit/02-file-manifest.json |
| `app/api/ai/recommendation/history/route.ts` | **INVESTIGATE** | 43 | Ingen UI-fetch funnet i crawl. | app/(backoffice)/backoffice/ai/overview/page.tsx; app/api/ai/recommendation/history/route.ts; docs/audit/02-file-manifest.json; docs/audit/parts/06b-paths-app.md; docs/operations/api-auth-inventory.md |
| `app/api/ai/rewrite/route.ts` | **INVESTIGATE** | 60 | Ingen UI-fetch funnet i crawl. | lib/ai/editorRewrite.ts; app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts; scripts/smoke/dc-011-smoke.mjs; tests/security/ai-routes-auth.test.ts; docs/audit/02-file-manifest.json |
| `app/api/ai/route.ts` | **INVESTIGATE** | 19 | Ingen UI-fetch funnet i crawl. | lib/ai/dashboardEngine.ts; lib/ai/editorRewrite.ts; lib/ai/logActivity.ts; lib/ai/pageIntent.ts; lib/ai/runnerGovernance.ts |
| `app/api/ai/track/route.ts` | **INVESTIGATE** | 56 | Ingen UI-fetch funnet i crawl. | lib/ai/tracking.ts; docs/audit/02-file-manifest.json; docs/audit/parts/06b-paths-app.md; docs/operations/api-auth-inventory.md; docs/repo-audit/U00R2_FULL_FOLDER_CLASSIFICATION.md |
| `app/api/ai/usage/route.ts` | **KEEP** | 256 | Backoffice AI overview fetch. | app/(backoffice)/backoffice/ai/overview/page.tsx; app/api/ai/usage/route.ts; scripts/audit/phase2-cut-list-gen.mjs; docs/audit/02-file-manifest.json; docs/audit/parts/06b-paths-app.md |

**Live P2 (utenfor `/api/ai/`):** `kitchen/demand-forecast`, `admin/demand-insights`, `admin/operations-tower` → **KEEP**.

---

## STOP — FASE A complete

Thomas review → FASE B per CUT-gruppe. **INVESTIGATE skal ikke bli CUT uten eksplisitt godkjenning.**

*Generated READ-ONLY · `scripts/audit/phase2-full-repo-cut-list.mjs`*
