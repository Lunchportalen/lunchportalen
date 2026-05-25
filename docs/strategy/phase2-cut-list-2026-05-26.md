# Phase 2 — Cut-list classification (FASE A.5 complete)

**Date:** 2026-05-26  
**Mode:** READ-ONLY · **0 INVESTIGATE** · klar for Fase B  
**Baseline:** [phase2-ai-inventory-2026-05-26.md](./phase2-ai-inventory-2026-05-26.md)  
**Prior:** commit `3049f3f2` → A.5 commit

---

## Crawl-scope (verifikasjon)

### Primær crawl (A.5 arver fra 3049f3f2)

6 053 filer — se [prior audit](./phase2-cut-list-2026-05-26.json) `crawlReport`.

### A.5 supplement crawl

| Område | Finnes | Filer | AI-treff på CUT-kandidater |
|--------|--------|------:|----------------------------|
| `lib/sanity/` | ja | 7 | 0 |
| `supabase/functions/` | nei | 0 | 0 |
| `lib/cron/` | nei | 0 | 0 |
| `sanity/` | nei | 0 | 0 |
| `playwright/` | nei | 0 | 0 |
| `cypress/` | nei | 0 | 0 |

**Delta A.1:** Ingen CUT-kandidat re-klassifisert av supplement crawl.

**Hooks:** via `lib/hooks/` (primær crawl).

---

## Sammendrag

| Metrikk | A.5 (nå) | Prior (3049f3f2) |
|---------|----------:|------------------:|
| **KEEP** | 213 (84.1% LOC) | 132 |
| **CUT** | 27 (2.6% LOC) | 73 |
| **REFACTOR** | 37 (13.3% LOC) | 12 |
| **INVESTIGATE** | **0** | 60 |

**LOC totalt:** 29570 · **Filer:** 277

---

## Verifikasjons-checklist (A.5)

- [x] Supplement crawl: lib/sanity, supabase/functions, lib/cron, sanity/, playwright, cypress
- [x] Dynamic-fetch grep (B.1) for alle `/api/ai/*` routes
- [x] Postman/HAR (B.2): 0 collections funnet
- [x] Docs partner-API (B.3): ingen ekstern AI-route-kontrakt
- [x] Thomas-beslutninger 1–4 anvendt
- [x] Resterende INVESTIGATE løst deterministisk
- [x] **0 INVESTIGATE gjenstår**

---

## Resolved INVESTIGATE-beslutninger (0 filer)

| Fil | Fra | Til | Grunn |
|-----|-----|-----|-------|


---

## Delta fra prior cut-list (59 endringer)

| Fil | Fra | Til | Grunn |
|-----|-----|-----|-------|
| `actions/mapDecisionToAction.ts` | CUT | **KEEP** | transitive-closure |
| `adaptiveScoring.ts` | KEEP | **CUT** | thomas-3-final |
| `agents/ceoAgent.ts` | CUT | **KEEP** | transitive-closure |
| `agents/cmoAgent.ts` | CUT | **KEEP** | transitive-closure |
| `agents/cooAgent.ts` | CUT | **KEEP** | transitive-closure |
| `agents/ctoAgent.ts` | CUT | **KEEP** | transitive-closure |
| `agents/index.ts` | CUT | **KEEP** | transitive-closure |
| `audience.ts` | CUT | **KEEP** | transitive-closure |
| `capital/capitalState.ts` | CUT | **KEEP** | transitive-closure |
| `capital/investmentAreas.ts` | CUT | **KEEP** | transitive-closure |
| `cmsAiPrompts.ts` | CUT | **KEEP** | transitive-closure |
| `cmsAiTypes.ts` | CUT | **KEEP** | transitive-closure |
| `conversion/engine.ts` | CUT | **KEEP** | transitive-closure |
| `croAnalyzer.ts` | CUT | **KEEP** | transitive-closure |
| `decisionId.ts` | CUT | **KEEP** | transitive-closure |
| `design/suggestDesignImprovements.ts` | CUT | **KEEP** | transitive-closure |
| `design/types.ts` | CUT | **KEEP** | transitive-closure |
| `enrichPageBuilderBlocks.ts` | CUT | **KEEP** | transitive-closure |
| `entitlements.ts` | CUT | **KEEP** | transitive-closure |
| `evaluator.ts` | CUT | **KEEP** | transitive-closure |
| `events/triggers.ts` | CUT | **KEEP** | transitive-closure |
| `evolve.ts` | CUT | **KEEP** | transitive-closure |
| `experienceModel.ts` | CUT | **KEEP** | transitive-closure |
| `experiments/revenueExperimentHints.ts` | CUT | **KEEP** | transitive-closure |
| `governanceApplySafety.ts` | CUT | **KEEP** | transitive-closure |
| `governor.ts` | CUT | **KEEP** | transitive-closure |
| `insightsEngine.ts` | CUT | **KEEP** | transitive-closure |
| `intelligence/confidence.ts` | CUT | **KEEP** | transitive-closure |
| `intelligence/patterns.ts` | CUT | **KEEP** | transitive-closure |
| `intelligence/scaleDecision.ts` | CUT | **KEEP** | transitive-closure |
| `intelligence/scalePolicy.ts` | CUT | **KEEP** | transitive-closure |
| `intelligence/signals.ts` | CUT | **KEEP** | transitive-closure |
| `intelligence/trends.ts` | CUT | **KEEP** | transitive-closure |
| `jobs/backoff.ts` | CUT | **KEEP** | transitive-closure |
| `jobs/claim.ts` | CUT | **KEEP** | transitive-closure |
| `learningBySurface.ts` | CUT | **KEEP** | transitive-closure |
| `memory/aiMemory.ts` | CUT | **KEEP** | transitive-closure |
| `memoryDecay.ts` | CUT | **KEEP** | transitive-closure |
| `pageBuilderPrompts.ts` | CUT | **KEEP** | transitive-closure |
| `pricing/engine.ts` | CUT | **KEEP** | transitive-closure |
| `profit/profitState.ts` | CUT | **KEEP** | transitive-closure |
| `retention/engine.ts` | CUT | **KEEP** | transitive-closure |
| `revenue/attribution.ts` | CUT | **KEEP** | transitive-closure |
| `schema/index.ts` | CUT | **KEEP** | transitive-closure |
| `schema/payloads.ts` | CUT | **KEEP** | transitive-closure |
| `schema/schemaRef.ts` | CUT | **KEEP** | transitive-closure |
| `schema/validate.ts` | CUT | **KEEP** | transitive-closure |
| `segmentation/engine.ts` | CUT | **KEEP** | transitive-closure |
| `seoAnalyzer.ts` | CUT | **KEEP** | transitive-closure |
| `strategicContext.ts` | CUT | **KEEP** | transitive-closure |
| `strictBlockValidator.ts` | CUT | **KEEP** | transitive-closure |
| `systemState.ts` | CUT | **KEEP** | transitive-closure |
| `tools/abGenerateVariants.ts` | CUT | **KEEP** | transitive-closure |
| `tools/contentMaintainPage.ts` | CUT | **KEEP** | transitive-closure |
| `tools/landingGenerateSections.ts` | CUT | **KEEP** | transitive-closure |
| `tools/seoOptimizePage.ts` | CUT | **KEEP** | transitive-closure |
| `tools/translateBlocks.ts` | CUT | **KEEP** | transitive-closure |
| `transientAiJsonCache.ts` | CUT | **KEEP** | transitive-closure |
| `validateComponentOutput.ts` | CUT | **KEEP** | transitive-closure |


---

## Per-fil klassifisering (`lib/ai`)

| Fil | Class | LOC | Justification | Consumers funnet | Scope |
|-----|-------|----:|---------------|------------------|-------|
| `_internalProvider.ts` | **KEEP** | 500 | Thomas A.5: KEEP — transitivt via runner.ts; CI-script bekrefter provider-surface. | scripts/check-ai-internal-provider.mjs; docs/audit/lib-ai-decision.md; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | scheduled,docs |
| `actions/mapDecisionToAction.ts` | **KEEP** | 104 | Transitive KEEP fra prod-closure (autonomy/automationLayer.ts). | ingen | ingen-ekstern |
| `adaptiveLearning.ts` | **KEEP** | 914 | Deterministisk: ≥1 ekstern consumer (app/api/ai/business-engine/route.ts +7). | app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; lib/observability/graphMetrics.ts; app/api/ai/business-engine/route.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts (+3) | kode,docs |
| `adaptiveScoring.ts` | **CUT** | 131 | Thomas A.5: CUT — Pillar 1 deferred (phase2-synergi-roadmap); overstyrer transitive closure. | docs/strategy/phase2-ai-inventory-2026-05-26.md | docs |
| `adsEngine.ts` | **KEEP** | 73 | Deterministisk: ≥1 ekstern consumer (app/api/ai/growth/ads/route.ts +2). | app/api/ai/growth/ads/route.ts; app/api/ai/growth/ads/route.ts; app/api/ai/growth/ads/route.ts | kode |
| `agents/ceoAgent.ts` | **KEEP** | 30 | Transitive KEEP fra prod-closure (agents/index.ts). | ingen | ingen-ekstern |
| `agents/cmoAgent.ts` | **KEEP** | 32 | Transitive KEEP fra prod-closure (agents/index.ts). | ingen | ingen-ekstern |
| `agents/contentHealthDaily.ts` | **KEEP** | 140 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/health/scan/route.ts +2). | app/api/backoffice/ai/health/scan/route.ts; app/api/backoffice/ai/health/scan/route.ts; app/api/backoffice/ai/health/scan/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `agents/cooAgent.ts` | **KEEP** | 20 | Transitive KEEP fra prod-closure (agents/index.ts). | ingen | ingen-ekstern |
| `agents/ctoAgent.ts` | **KEEP** | 30 | Transitive KEEP fra prod-closure (agents/index.ts). | ingen | ingen-ekstern |
| `agents/index.ts` | **KEEP** | 15 | Transitive KEEP fra prod-closure (autonomy/collectDecisions.ts). | ingen | ingen-ekstern |
| `aiEntrypointContext.ts` | **KEEP** | 50 | Deterministisk: ≥1 ekstern consumer (lib/http/withApiAiEntrypoint.ts +1). | lib/http/withApiAiEntrypoint.ts; lib/system/controlStrict.ts; docs/audit/lib-ai-decision.md; docs/audit/repo-state-2026-05-23-post-marathon.md; docs/operations/api-auth-inventory.md; docs/operations/api-auth-inventory.md | kode,docs |
| `aiPageGuardrails.ts` | **KEEP** | 47 | Deterministisk: ≥1 ekstern consumer (lib/hooks/useAiPageBuilder.ts +2). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts | kode |
| `analysis/contentHealth.ts` | **KEEP** | 72 | Deterministisk: transitiv via agents/contentHealthDaily → backoffice/ai/health/scan (prod route). | tests/ai/aiSystemGuarantees.test.ts; tests/ai/aiSystemGuarantees.test.ts; tests/ai/aiSystemGuarantees.test.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | tests,docs |
| `anomaly.ts` | **KEEP** | 52 | Deterministisk: ≥1 ekstern consumer (app/superadmin/control-tower/actions.ts +1). | app/superadmin/control-tower/actions.ts; app/superadmin/control-tower/ControlTowerClient.tsx; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `attribution.ts` | **KEEP** | 31 | Deterministisk: ≥1 ekstern consumer (lib/business/revenue.ts +9). | lib/business/revenue.ts; lib/revenue/trigger.ts; lib/business/revenue.ts; lib/business/revenue.ts; lib/business/revenueTrack.ts; lib/revenue/trackOrderAiConversion.ts (+6) | kode,docs |
| `attribution/aggregationEngine.ts` | **CUT** | 62 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `attribution/attributionModel.ts` | **KEEP** | 47 | Deterministisk: ≥1 ekstern consumer (app/api/public/track-event/route.ts +2). | app/api/public/track-event/route.ts; app/api/public/track-event/route.ts; app/api/public/track-event/route.ts | kode |
| `attribution/insightEngine.ts` | **CUT** | 19 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `attribution/roiEngine.ts` | **CUT** | 41 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `attribution/storeAttribution.ts` | **KEEP** | 42 | Deterministisk: ≥1 ekstern consumer (app/api/public/track-event/route.ts +4). | app/api/public/track-event/route.ts; lib/revenue/session.ts; app/api/public/track-event/route.ts; app/api/public/track-event/route.ts; components/revenue/AttributionCapture.tsx | kode |
| `audience.ts` | **KEEP** | 23 | Transitive KEEP fra prod-closure (adsEngine.ts). | ingen | ingen-ekstern |
| `autoImprove.ts` | **KEEP** | 82 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/auto-improve/route.ts +2). | app/api/backoffice/ai/auto-improve/route.ts; tests/ai/autoImprove.test.ts; app/api/backoffice/ai/auto-improve/route.ts; app/api/backoffice/ai/auto-improve/route.ts; tests/ai/autoImprove.test.ts; tests/ai/autoImprove.test.ts (+1) | kode,tests,docs |
| `autonomy/automationLayer.ts` | **REFACTOR** | 69 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | ingen | ingen-ekstern |
| `autonomy/autonomyAttribution.ts` | **REFACTOR** | 39 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/autonomy/feedback/route.ts; app/api/backoffice/autonomy/feedback/route.ts; app/api/backoffice/autonomy/feedback/route.ts | kode |
| `autonomy/autonomyLearning.ts` | **REFACTOR** | 44 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | ingen | ingen-ekstern |
| `autonomy/autonomyLog.ts` | **REFACTOR** | 60 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/(backoffice)/backoffice/ai-control/page.tsx; app/api/backoffice/autonomy/feedback/route.ts; app/(backoffice)/backoffice/ai-control/page.tsx; app/(backoffice)/backoffice/ai-control/page.tsx; app/api/backoffice/autonomy/feedback/route.ts; app/api/backoffice/autonomy/feedback/route.ts | kode |
| `autonomy/autonomyPolicy.ts` | **REFACTOR** | 63 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | ingen | ingen-ekstern |
| `autonomy/collectDecisions.ts` | **REFACTOR** | 37 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | ingen | ingen-ekstern |
| `autonomy/runner.ts` | **REFACTOR** | 137 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/autonomy/run/route.ts; lib/social/automationEngine.ts; lib/social/autonomousRunner.ts; app/api/backoffice/autonomy/run/route.ts; app/api/backoffice/autonomy/run/route.ts; app/api/social/run/route.ts (+1) | kode |
| `autonomy/types.ts` | **REFACTOR** | 50 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/autonomy/feedback/route.ts; lib/autonomy/execute.ts; lib/autonomy/mapActions.ts; lib/autonomy/policy.ts; lib/autonomy/run.ts; lib/autonomy/types.ts (+3) | kode |
| `autonomyController.ts` | **REFACTOR** | 65 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | lib/autonomy/config.ts; lib/autonomy/override.ts; lib/autonomy/types.ts; lib/salesAutonomy/config.ts; lib/salesAutonomy/types.ts; app/api/superadmin/autonomy/route.ts (+1) | kode |
| `batchApply.ts` | **KEEP** | 145 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx +2). | app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; docs/umbraco-parity/U22_COLLECTIONS_AND_ENTITY_ACTIONS_BASELINE.md; docs/umbraco-parity/U27_BULK_AND_LEGACY_BASELINE.md; docs/umbraco-parity/U30X_READ_R3_EXTENSION_TYPE_PARITY_MATRIX.md | kode,docs |
| `billing.ts` | **KEEP** | 271 | Deterministisk: ≥1 ekstern consumer (lib/saas/billing.ts +9). | lib/saas/billing.ts; app/api/ai/usage/route.ts; lib/copy/admin.copy.nb.json; lib/saas/billing.ts; lib/saas/billing.ts; lib/superadmin/capabilities.ts (+4) | kode |
| `blockFactory.ts` | **KEEP** | 138 | Deterministisk: ≥1 ekstern consumer (lib/hooks/useAiPageBuilder.ts +2). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts | kode |
| `blockSchema.ts` | **KEEP** | 411 | Deterministisk: ≥1 ekstern consumer (lib/cms/blocks/componentRegistry.ts). | tests/lib/ai/blockSchema.test.ts; lib/cms/blocks/componentRegistry.ts; tests/lib/ai/blockSchema.test.ts; tests/lib/ai/blockSchema.test.ts; docs/audit/lib-ai-decision.md; docs/audit/parts/06e-paths-supabase-docs-tests-e2e.md (+1) | kode,tests,docs |
| `buildHomeFromIntentBody.ts` | **KEEP** | 131 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/build-home-from-intent/route.ts +9). | app/api/backoffice/ai/build-home-from-intent/route.ts; lib/cms/cmsDraftEnvironment.ts; lib/experiments/applyWinnerToCms.ts; lib/experiments/createHomeTrafficExperimentCore.ts; app/(backoffice)/backoffice/content/_components/contentWorkspace.persistence.ts; app/(backoffice)/backoffice/content/_components/contentWorkspace.preview.ts (+5) | kode,docs |
| `businessMetrics.ts` | **KEEP** | 97 | Deterministisk: ≥1 ekstern consumer (lib/observability/metricsEngine.ts +5). | lib/observability/metricsEngine.ts; lib/observability/systemSnapshot.ts; lib/observability/metricsEngine.ts; lib/observability/metricsEngine.ts; lib/observability/systemSnapshot.ts; lib/observability/systemSnapshot.ts | kode |
| `businessObjective.ts` | **KEEP** | 985 | Deterministisk: ≥1 ekstern consumer (lib/pos/signalCollector.ts +7). | lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts; app/api/ai/business-engine/route.ts (+2) | kode |
| `capital/actionGenerator.ts` | **KEEP** | 23 | Deterministisk: ≥1 ekstern consumer (lib/autonomy/engine.ts +12). | lib/autonomy/engine.ts; lib/autonomy/generateActions.ts; lib/ceo/actions.ts; lib/ceo/run.ts; lib/domination/engine.ts; lib/domination/index.ts (+8) | kode,tests |
| `capital/actionPriority.ts` | **CUT** | 14 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `capital/allocationEngine.ts` | **CUT** | 43 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `capital/capitalOutput.ts` | **CUT** | 27 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `capital/capitalState.ts` | **KEEP** | 69 | Transitive KEEP fra prod-closure (capital/actionGenerator.ts). | ingen | ingen-ekstern |
| `capital/executionEngine.ts` | **CUT** | 20 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `capital/executionPlan.ts` | **CUT** | 18 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `capital/investmentAreas.ts` | **KEEP** | 11 | Transitive KEEP fra prod-closure (capital/actionGenerator.ts). | ingen | ingen-ekstern |
| `capital/riskEngine.ts` | **CUT** | 22 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `capital/roiEngine.ts` | **CUT** | 22 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `ceo/attribution.ts` | **REFACTOR** | 36 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/ceo/feedback/route.ts; app/api/backoffice/ceo/feedback/route.ts; app/api/backoffice/ceo/feedback/route.ts | kode |
| `ceo/automationEngine.ts` | **REFACTOR** | 63 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/pipeline/actions/route.ts | kode |
| `ceo/ceoLog.ts` | **REFACTOR** | 55 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/(backoffice)/backoffice/control/page.tsx; app/api/backoffice/ceo/feedback/route.ts; app/(backoffice)/backoffice/control/page.tsx; app/(backoffice)/backoffice/control/page.tsx; app/api/backoffice/ceo/feedback/route.ts; app/api/backoffice/ceo/feedback/route.ts | kode |
| `ceo/decisionEngine.ts` | **REFACTOR** | 169 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/ceo/recommendations/route.ts; app/api/backoffice/ceo/recommendations/route.ts; app/api/backoffice/ceo/recommendations/route.ts | kode |
| `ceo/growthEngine.ts` | **REFACTOR** | 53 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/ceo/recommendations/route.ts; app/api/backoffice/ceo/recommendations/route.ts; app/api/backoffice/ceo/recommendations/route.ts | kode |
| `ceo/learning.ts` | **REFACTOR** | 43 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | ingen | ingen-ekstern |
| `ceo/policyEngine.ts` | **REFACTOR** | 51 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | lib/autonomy/execute.ts; lib/autonomy/policy.ts | kode |
| `ceo/runner.ts` | **REFACTOR** | 131 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/ceo/run/route.ts; app/api/backoffice/ceo/run/route.ts; app/api/backoffice/ceo/run/route.ts | kode |
| `ceo/types.ts` | **REFACTOR** | 66 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/ceo/feedback/route.ts; app/(backoffice)/backoffice/content/_components/EditorCeoRecommendationsPanel.tsx; app/api/backoffice/ceo/feedback/route.ts; app/api/backoffice/ceo/feedback/route.ts | kode |
| `ceoExecutor.ts` | **REFACTOR** | 27 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | lib/autopilot/engine.ts; lib/autopilot/engine.ts; lib/autopilot/engine.ts | kode |
| `cmsAiActions.ts` | **KEEP** | 14 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/cms-menu/route.ts +2). | app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cms-menu/route.ts; tests/ai/cmsAiEngine.heuristic.test.ts | kode,tests |
| `cmsAiEngine.ts` | **REFACTOR** | 278 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts +2). | app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; tests/ai/cmsAiEngine.heuristic.test.ts; app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/api/backoffice/ai/cms-menu/route.ts; tests/ai/cmsAiEngine.heuristic.test.ts; tests/ai/cmsAiEngine.heuristic.test.ts (+3) | kode,tests,docs |
| `cmsAiPrompts.ts` | **KEEP** | 105 | Transitive KEEP fra prod-closure (cmsAiEngine.ts). | ingen | ingen-ekstern |
| `cmsAiTenant.ts` | **KEEP** | 50 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/suggest/route.ts +2). | app/api/backoffice/ai/suggest/route.ts; tests/ai/cmsAiTenant.test.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; tests/ai/CmsAiAuthRuntimeParity.test.ts; tests/ai/cmsAiTenant.test.ts (+1) | kode,tests |
| `cmsAiTypes.ts` | **KEEP** | 43 | Transitive KEEP fra prod-closure (cmsAiEngine.ts). | ingen | ingen-ekstern |
| `company/actionTypes.ts` | **REFACTOR** | 62 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | ingen | ingen-ekstern |
| `company/anomaly.ts` | **REFACTOR** | 69 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | ingen | ingen-ekstern |
| `company/automationEngine.ts` | **REFACTOR** | 178 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `company/decisionEngine.ts` | **REFACTOR** | 135 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | ingen | ingen-ekstern |
| `company/memory.ts` | **REFACTOR** | 48 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `company/policyEngine.ts` | **REFACTOR** | 244 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `company/safety.ts` | **REFACTOR** | 48 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | ingen | ingen-ekstern |
| `company/types.ts` | **REFACTOR** | 106 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. | app/api/backoffice/company/control-tower/route.ts; app/(backoffice)/backoffice/content/_components/EditorAiControlTowerPanel.tsx; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `config.ts` | **KEEP** | 41 | Deterministisk: ≥1 ekstern consumer (lib/cms/public/normalizeBlockForRender.ts +40). | lib/cms/public/normalizeBlockForRender.ts; app/(backoffice)/backoffice/content/_components/CmsBlockDesignSection.tsx; scripts/k6/results/2026-05-23T19-20-53-681Z-summary-export.json; scripts/k6/results/2026-05-23T19-21-26-051Z-summary.json; scripts/k6/results/2026-05-23T19-23-32-503Z-summary-export.json; scripts/k6/results/2026-05-23T19-24-04-958Z-summary.json (+36) | kode,scheduled,cms,docs |
| `context.ts` | **KEEP** | 98 | Deterministisk: ≥1 ekstern consumer (app/api/ai/copilot/route.ts +5). | app/api/ai/copilot/route.ts; lib/sales/context.ts; lib/sales/handleObjection.ts; app/api/ai/copilot/route.ts; app/api/ai/copilot/route.ts; app/api/backoffice/company/control-tower/route.ts (+6) | kode,docs |
| `context/systemContext.ts` | **KEEP** | 92 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/company/control-tower/route.ts +2). | app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/company/control-tower/route.ts | kode |
| `continuation.ts` | **KEEP** | 66 | Deterministisk: ≥1 ekstern consumer (app/api/ai/continue/route.ts +2). | app/api/ai/continue/route.ts; app/api/ai/continue/route.ts; app/api/ai/continue/route.ts | kode |
| `control/controlGate.ts` | **CUT** | 49 | Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts. | tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts | tests |
| `control/ethicsEngine.ts` | **CUT** | 15 | Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts. | tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts | tests |
| `control/explainEngine.ts` | **CUT** | 18 | Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts. | tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts | tests |
| `control/governanceEngine.ts` | **CUT** | 18 | Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts. | tests/ai/controlLayer.test.ts; lib/autonomy/engine.ts; lib/autonomy/validator.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/autonomy/autonomy-pure.test.ts | kode,tests |
| `control/killSwitch.ts` | **CUT** | 11 | Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts. | tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; docs/audit/lib-ai-decision.md; docs/audit/lib-ai-decision.md | tests,docs |
| `control/normalizeControlType.ts` | **CUT** | 19 | Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts. | ingen | ingen-ekstern |
| `control/overrideEngine.ts` | **CUT** | 12 | Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts. | ingen | ingen-ekstern |
| `control/riskEngine.ts` | **CUT** | 13 | Thomas A.5: CUT — kun test-consumers; slettes atomisk med tests/ai/controlLayer.test.ts. | tests/ai/controlLayer.test.ts; lib/simulation/risk.ts; app/superadmin/control-tower/ControlTowerClient.tsx; tests/ai/controlLayer.test.ts; tests/ai/controlLayer.test.ts; tests/finance/finance-and-simulation.test.ts | kode,tests |
| `controlTower/actionRegistry.ts` | **KEEP** | 25 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts +5). | app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts; app/api/control-tower/route.ts; tests/ai/controlTower.test.ts; app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts; app/(backoffice)/backoffice/content/_components/ContentWorkspaceActions.ts; app/api/control-tower/route.ts (+3) | kode,tests |
| `controlTower/controlExecutor.ts` | **REFACTOR** | 109 | Deterministisk: ≥1 ekstern consumer (app/api/control-tower/route.ts +2). | app/api/control-tower/route.ts; app/api/control-tower/route.ts; app/api/control-tower/route.ts | kode |
| `conversion/engine.ts` | **KEEP** | 67 | Transitive KEEP fra prod-closure (enterprise/buildDashboardPayload.ts). | ingen | ingen-ekstern |
| `conversionGenerator.ts` | **KEEP** | 57 | Deterministisk: ≥1 ekstern consumer (lib/social/unifiedGenerator.ts +3). | lib/social/unifiedGenerator.ts; lib/social/unifiedGenerator.ts; lib/social/unifiedGenerator.ts; app/api/social/ai/generate/route.ts; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `copilot.ts` | **KEEP** | 92 | Deterministisk: ≥1 ekstern consumer (app/api/ai/copilot/route.ts +8). | app/api/ai/copilot/route.ts; app/(backoffice)/backoffice/content/_components/ContentWorkspaceRightRail.tsx; app/(backoffice)/backoffice/content/_components/contentWorkspaceRightRailSlots.ts; app/(backoffice)/backoffice/content/_components/EditorCopilotRail.tsx; app/(backoffice)/backoffice/content/_components/useContentWorkspaceCopilot.ts; app/api/ai/copilot/route.ts (+11) | kode,scheduled,tests,docs |
| `croAnalyzer.ts` | **KEEP** | 97 | Transitive KEEP fra prod-closure (copilot.ts). | docs/strategy/phase2-ai-inventory-2026-05-26.md | docs |
| `crossSurfaceLearning.ts` | **KEEP** | 44 | Deterministisk: ≥1 ekstern consumer (lib/pos/crossSurfaceLearning.ts +4). | lib/pos/crossSurfaceLearning.ts; lib/pos/crossSurfaceLearning.ts; lib/pos/crossSurfaceLearning.ts; lib/pos/index.ts; lib/pos/learningRouter.ts | kode |
| `ctaOptimizer.ts` | **KEEP** | 11 | Deterministisk: ≥1 ekstern consumer (lib/social/unifiedGenerator.ts +2). | lib/social/unifiedGenerator.ts; lib/social/unifiedGenerator.ts; lib/social/unifiedGenerator.ts | kode |
| `dashboard.ts` | **KEEP** | 88 | Deterministisk: ≥1 ekstern consumer (app/api/ai/dashboard/route.ts +22). | app/api/ai/dashboard/route.ts; lib/copy/admin.copy.nb.json; app/(backoffice)/backoffice/ai/overview/page.tsx; app/(backoffice)/backoffice/content/_tree/treeMock.ts; app/api/ai/business-engine/route.ts; app/api/ai/dashboard/route.ts (+26) | kode,scheduled,tests,cms,docs |
| `dashboardEngine.ts` | **KEEP** | 232 | Deterministisk: ≥1 ekstern consumer (app/api/ai/usage/route.ts +2). | app/api/ai/usage/route.ts; app/api/ai/usage/route.ts; app/api/ai/usage/route.ts | kode |
| `debounce.ts` | **KEEP** | 14 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/useContentWorkspaceCopilot.ts +17). | app/(backoffice)/backoffice/content/_components/useContentWorkspaceCopilot.ts; app/(backoffice)/backoffice/content/_components/useContentWorkspaceRichTextAi.ts; app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts; lib/pos/eventHandler.ts; app/(backoffice)/backoffice/content/_components/CONTENT_WORKSPACE_NAVIGATION_CLUSTER_MAP.md; app/(backoffice)/backoffice/content/_components/CONTENT_WORKSPACE_RESPONSIBILITY_MAP.md (+17) | kode,cms,docs |
| `decisionEngine.ts` | **KEEP** | 271 | Deterministisk: ≥1 ekstern consumer (lib/http/withApiAiEntrypoint.ts +25). | lib/http/withApiAiEntrypoint.ts; lib/pos/decisionRouter.ts; lib/pos/executionRouter.ts; lib/pos/posActionMemory.ts; lib/pos/posStabilizer.ts; lib/pos/signalCollector.ts (+20) | kode |
| `decisionId.ts` | **KEEP** | 13 | Transitive KEEP fra prod-closure (decisionEngine.ts). | ingen | ingen-ekstern |
| `decisionLog.ts` | **KEEP** | 56 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +25). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/SocialContentCalendar.tsx; lib/ceo/buildSnapshot.ts; lib/evolution/decide.ts; lib/evolution/types.ts; lib/growth/profitOptimizationPipeline.ts (+76) | kode,scheduled,docs |
| `decisions.ts` | **KEEP** | 39 | Deterministisk: ≥1 ekstern consumer (lib/social/automationEngine.ts). | lib/social/automationEngine.ts | kode |
| `demandData.ts` | **KEEP** | 103 | Deterministisk: ≥1 ekstern consumer (app/api/admin/demand-insights/route.ts +11). | app/api/admin/demand-insights/route.ts; app/api/admin/operations-tower/route.ts; app/api/kitchen/demand-forecast/route.ts; app/api/order/week-demand-hints/route.ts; app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts (+10) | kode,docs |
| `demandEngine.ts` | **REFACTOR** | 224 | Deterministisk: ≥1 ekstern consumer (app/api/admin/demand-insights/route.ts +11). | app/api/admin/demand-insights/route.ts; app/api/admin/operations-tower/route.ts; app/api/kitchen/demand-forecast/route.ts; app/kitchen/KitchenView.tsx; app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts (+13) | kode,docs |
| `demandInsights.ts` | **KEEP** | 114 | Deterministisk: ≥1 ekstern consumer (app/api/admin/demand-insights/route.ts +5). | app/api/admin/demand-insights/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts (+4) | kode,docs |
| `design/analyzeDesign.ts` | **KEEP** | 135 | Deterministisk: ≥1 ekstern consumer (app/api/ai/design/analyze/route.ts). | tests/ai/analyzeDesign.test.ts; app/api/ai/design/analyze/route.ts; tests/ai/analyzeDesign.test.ts; tests/ai/analyzeDesign.test.ts; docs/audit/lib-ai-decision.md; docs/audit/parts/06e-paths-supabase-docs-tests-e2e.md | kode,tests,docs |
| `design/applyDesignChanges.ts` | **KEEP** | 103 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/design-optimizer/analyze/route.ts +8). | app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts (+3) | kode |
| `design/designMetrics.ts` | **KEEP** | 75 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/design-optimizer/analyze/route.ts +5). | app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts | kode |
| `design/designPolicy.ts` | **KEEP** | 116 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/design-optimizer/apply/route.ts +2). | app/api/backoffice/ai/design-optimizer/apply/route.ts; tests/ai/designPolicy.test.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; tests/ai/designPolicy.test.ts; tests/ai/designPolicy.test.ts | kode,tests |
| `design/designSettingsOptimizer.ts` | **KEEP** | 312 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/design-optimizer/analyze/route.ts +11). | app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/revert/route.ts; app/api/backoffice/company/control-tower/route.ts; tests/ai/designSettingsOptimizer.test.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts (+9) | kode,tests |
| `design/lastDesignApply.ts` | **KEEP** | 48 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/design-optimizer/apply/route.ts +2). | app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts | kode |
| `design/suggestDesignImprovements.ts` | **KEEP** | 103 | Transitive KEEP fra prod-closure (design/designSettingsOptimizer.ts). | ingen | ingen-ekstern |
| `design/types.ts` | **KEEP** | 55 | Transitive KEEP fra prod-closure (design/analyzeDesign.ts). | tests/ai/designPolicy.test.ts; tests/ai/designPolicy.test.ts | tests |
| `designAnalyzer.ts` | **KEEP** | 203 | Deterministisk: ≥1 ekstern consumer (app/api/ai/design/analyze/route.ts +2). | app/api/ai/design/analyze/route.ts; app/api/ai/design/analyze/route.ts; app/api/ai/design/analyze/route.ts; tests/ai/analyzeDesign.test.ts; docs/audit/lib-ai-decision.md; docs/audit/parts/06e-paths-supabase-docs-tests-e2e.md | kode,tests,docs |
| `designGenerator.ts` | **KEEP** | 115 | Deterministisk: ≥1 ekstern consumer (app/api/ai/design/generate/route.ts +2). | app/api/ai/design/generate/route.ts; app/api/ai/design/generate/route.ts; app/api/ai/design/generate/route.ts | kode |
| `designTokens.ts` | **KEEP** | 71 | Deterministisk: ≥1 ekstern consumer (lib/pos/executionRouter.ts +9). | lib/pos/executionRouter.ts; lib/pos/surfaceRegistry.ts; app/api/ai/design/generate/route.ts; lib/pos/executionRouter.ts; lib/pos/executionRouter.ts; lib/pos/index.ts (+5) | kode,docs |
| `editorRewrite.ts` | **REFACTOR** | 88 | Deterministisk: ≥1 ekstern consumer (components/cms/AiTextAssistPopover.tsx +2). | components/cms/AiTextAssistPopover.tsx; components/cms/AiTextAssistPopover.tsx; components/cms/AiTextAssistPopover.tsx | kode |
| `editorTextSuggest.ts` | **KEEP** | 85 | Deterministisk: ≥1 ekstern consumer (lib/autonomy/apply.ts +32). | lib/autonomy/apply.ts; lib/autonomy/runRevenue.ts; lib/business/runEngine.ts; lib/experiment/generate.ts; lib/experiment/generateCopyVariant.ts; lib/experiment/growthExperiment.ts (+35) | kode,docs |
| `engine.ts` | **KEEP** | 119 | Deterministisk: ≥1 ekstern consumer (lib/pos/signalCollector.ts +6). | lib/pos/signalCollector.ts; app/api/ai/analyze/route.ts; lib/pos/events.ts; lib/pos/signalCollector.ts; lib/pos/signalCollector.ts; app/api/ai/analyze/route.ts (+7) | kode,docs |
| `enrichPageBuilderBlocks.ts` | **KEEP** | 67 | Transitive KEEP fra prod-closure (pageBuilder.ts). | ingen | ingen-ekstern |
| `enterprise/buildDashboardPayload.ts` | **KEEP** | 91 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/enterprise/page.tsx +2). | app/(backoffice)/backoffice/enterprise/page.tsx; docs/audit/current-menu-architecture.md; app/(backoffice)/backoffice/enterprise/page.tsx; app/(backoffice)/backoffice/enterprise/page.tsx; docs/audit/current-menu-architecture.md; docs/audit/current-menu-architecture.md | kode,docs |
| `enterprise/enterpriseLog.ts` | **KEEP** | 48 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/enterprise/page.tsx +2). | app/(backoffice)/backoffice/enterprise/page.tsx; docs/audit/current-menu-architecture.md; app/(backoffice)/backoffice/enterprise/page.tsx; app/(backoffice)/backoffice/enterprise/page.tsx; docs/audit/current-menu-architecture.md; docs/audit/current-menu-architecture.md | kode,docs |
| `enterprise/pageInsights.ts` | **KEEP** | 79 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/enterprise/page-insights/route.ts +2). | app/api/backoffice/enterprise/page-insights/route.ts; app/api/backoffice/enterprise/page-insights/route.ts; app/api/backoffice/enterprise/page-insights/route.ts | kode |
| `entitlements.ts` | **KEEP** | 39 | Transitive KEEP fra prod-closure (billing.ts). | ingen | ingen-ekstern |
| `evaluator.ts` | **KEEP** | 36 | Transitive KEEP fra prod-closure (experiment.ts). | ingen | ingen-ekstern |
| `events/triggers.ts` | **KEEP** | 22 | Transitive KEEP fra prod-closure (autonomy/runner.ts). | ingen | ingen-ekstern |
| `evolve.ts` | **KEEP** | 38 | Transitive KEEP fra prod-closure (optimize.ts). | ingen | ingen-ekstern |
| `experienceModel.ts` | **KEEP** | 65 | Transitive KEEP fra prod-closure (predictiveModel.ts). | ingen | ingen-ekstern |
| `experiment.ts` | **REFACTOR** | 77 | Deterministisk: ≥1 ekstern consumer (app/api/ai/experiments/route.ts +42). | app/api/ai/experiments/route.ts; lib/backoffice/experiments/experimentsRepo.ts; lib/experiment/growthExperiment.ts; lib/experiment/model.ts; lib/experiments/createHomeTrafficExperimentCore.ts; lib/experiments/overlayRunningExperiment.ts (+51) | kode,scheduled,tests,docs |
| `experimentGenerator.ts` | **KEEP** | 29 | Deterministisk: ≥1 ekstern consumer (lib/experiments/createHomeTrafficExperimentCore.ts +2). | lib/experiments/createHomeTrafficExperimentCore.ts; lib/experiments/createHomeTrafficExperimentCore.ts; lib/experiments/createHomeTrafficExperimentCore.ts | kode |
| `experimentWinnerDecision.ts` | **KEEP** | 227 | Deterministisk: ≥1 ekstern consumer (lib/experiments/overlayRunningExperiment.ts +15). | lib/experiments/overlayRunningExperiment.ts; app/api/backoffice/experiments/resolve/route.ts; lib/autopilot/runner.ts; lib/experiment/runSocialAbEvaluations.ts; lib/experiment/winner.ts; lib/experiments/overlayRunningExperiment.ts (+10) | kode |
| `experiments/aiExperimentsRepo.ts` | **KEEP** | 279 | Deterministisk: ≥1 ekstern consumer (lib/experiment/growthExperiment.ts +5). | lib/experiment/growthExperiment.ts; app/api/superadmin/experiments/route.ts; lib/experiment/growthExperiment.ts; lib/experiment/growthExperiment.ts; app/api/superadmin/experiments/route.ts; app/api/superadmin/experiments/route.ts (+2) | kode,docs |
| `experiments/analytics.ts` | **KEEP** | 77 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/experiments/event/route.ts +9). | app/api/backoffice/experiments/event/route.ts; app/api/backoffice/experiments/stats/route.ts; app/api/backoffice/experiments/[id]/route.ts; tests/backoffice/experimentAnalytics.test.ts; lib/experiment/evaluate.ts; app/api/backoffice/experiments/event/route.ts (+13) | kode,tests,docs |
| `experiments/revenueExperimentHints.ts` | **KEEP** | 66 | Transitive KEEP fra prod-closure (enterprise/buildDashboardPayload.ts). | ingen | ingen-ekstern |
| `fallbackHandler.ts` | **KEEP** | 118 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/suggest/route.ts +2). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts | kode |
| `feedback.ts` | **KEEP** | 256 | Deterministisk: ≥1 ekstern consumer (lib/pos/learningRouter.ts +3). | lib/pos/learningRouter.ts; lib/pos/learningRouter.ts; lib/pos/learningRouter.ts; app/(backoffice)/backoffice/design/page.tsx | kode |
| `funnelEngine.ts` | **KEEP** | 111 | Deterministisk: ≥1 ekstern consumer (app/api/ai/growth/funnel/route.ts +2). | app/api/ai/growth/funnel/route.ts; app/api/ai/growth/funnel/route.ts; app/api/ai/growth/funnel/route.ts | kode |
| `generateVariant.ts` | **KEEP** | 31 | Deterministisk: ≥1 ekstern consumer (lib/experiment/generate.ts +2). | tests/ai/generateVariant.test.ts; lib/experiment/generate.ts; lib/moo/generateVariant.ts; lib/revenue/applyLoop.ts; tests/ai/generateVariant.test.ts; tests/ai/generateVariant.test.ts (+1) | kode,tests,docs |
| `generator.ts` | **KEEP** | 99 | Deterministisk: ≥1 ekstern consumer (app/api/ai/generate/route.ts +2). | app/api/ai/generate/route.ts; app/api/ai/generate/route.ts; app/api/ai/generate/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `getClient.ts` | **KEEP** | 19 | Deterministisk: ≥1 ekstern consumer (lib/sales/aiResponse.ts +5). | lib/sales/aiResponse.ts; lib/sales/sequenceMessage.ts; lib/sales/aiResponse.ts; lib/sales/aiResponse.ts; lib/sales/sequenceMessage.ts; lib/sales/sequenceMessage.ts (+3) | kode,docs |
| `ghostText.ts` | **KEEP** | 27 | Deterministisk: ≥1 ekstern consumer (app/api/ai/inline/route.ts +2). | app/api/ai/inline/route.ts; app/api/ai/inline/route.ts; app/api/ai/inline/route.ts | kode |
| `governance/aiPolicy.ts` | **KEEP** | 124 | Deterministisk: ≥1 ekstern consumer (app/api/system/ai/diagnostics/route.ts +1). | app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `governanceApplySafety.ts` | **KEEP** | 274 | Transitive KEEP fra prod-closure (recommendationActions.ts). | ingen | ingen-ekstern |
| `governor.ts` | **KEEP** | 46 | Transitive KEEP fra prod-closure (run.ts). | ingen | ingen-ekstern |
| `image.ts` | **KEEP** | 51 | Deterministisk: ≥1 ekstern consumer (app/api/ai/image/route.ts +78). | app/api/ai/image/route.ts; lib/cms/blocks/blockEditorDataTypes.ts; lib/cms/blocks/blockTypeDefinitions.ts; lib/cms/design/designContract.ts; lib/cms/editorSmartHints.ts; lib/cms/media/resolveBlockMediaDeep.ts (+100) | kode,scheduled,tests,cms,docs |
| `improveContent.ts` | **KEEP** | 21 | Deterministisk: ≥1 ekstern consumer (lib/experiment/generateCopyVariant.ts +7). | lib/experiment/generateCopyVariant.ts; lib/experiment/growthExperiment.ts; lib/content/improve.ts; lib/experiment/generateCopyVariant.ts; lib/experiment/generateCopyVariant.ts; lib/experiment/growthExperiment.ts (+2) | kode |
| `improvementEngine.ts` | **KEEP** | 162 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx +2). | app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx | kode |
| `industry.ts` | **KEEP** | 25 | Deterministisk: ≥1 ekstern consumer (lib/growth/growthAttributionInsights.ts +42). | lib/growth/growthAttributionInsights.ts; lib/leads/createLead.ts; lib/leads/types.ts; lib/outbound/normalizeSegment.ts; lib/social/b2bLeadMessaging.ts; lib/social/calendar.ts (+37) | kode |
| `inline.ts` | **KEEP** | 50 | Deterministisk: ≥1 ekstern consumer (app/api/ai/inline/route.ts +15). | app/api/ai/inline/route.ts; lib/media/types.ts; app/(backoffice)/backoffice/content/_components/ContentDetailCompactBlockFrame.tsx; app/api/ai/inline/route.ts; app/api/ai/inline/route.ts; components/cms/blockCanvas/frames/CardsCanvasFrame.tsx (+18) | kode,tests,cms,docs |
| `insertAiSuggestionRow.ts` | **KEEP** | 91 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/suggest/route.ts +5). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggestions/[id]/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggestions/[id]/route.ts; app/api/backoffice/ai/suggestions/[id]/route.ts | kode |
| `insightsEngine.ts` | **KEEP** | 59 | Transitive KEEP fra prod-closure (dashboard.ts). | ingen | ingen-ekstern |
| `intelligence/confidence.ts` | **KEEP** | 70 | Transitive KEEP fra prod-closure (intelligence/index.ts). | ingen | ingen-ekstern |
| `intelligence/index.ts` | **REFACTOR** | 98 | Deterministisk: ≥1 ekstern consumer (app/api/ai/decision/route.ts +12). | app/api/ai/decision/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/intelligence/dashboard/route.ts; app/api/backoffice/ai/intelligence/events/route.ts; app/api/backoffice/ai/intelligence/query/route.ts (+10) | kode,tests,docs |
| `intelligence/learning.ts` | **KEEP** | 73 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/design-optimizer/apply/route.ts). | app/api/backoffice/ai/design-optimizer/apply/route.ts | kode |
| `intelligence/patterns.ts` | **KEEP** | 363 | Transitive KEEP fra prod-closure (intelligence/index.ts). | ingen | ingen-ekstern |
| `intelligence/query.ts` | **KEEP** | 89 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/intelligence/query/route.ts). | app/api/backoffice/ai/intelligence/query/route.ts | kode |
| `intelligence/scale.ts` | **KEEP** | 291 | Deterministisk: ≥1 ekstern consumer (lib/growth/scale-engine.ts +1). | lib/growth/scale-engine.ts; app/api/backoffice/company/control-tower/route.ts; docs/audit/repo-state-2026-05-23-deep-crawl.md | kode,docs |
| `intelligence/scaleApply.ts` | **KEEP** | 270 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/company/control-tower/route.ts). | app/api/backoffice/company/control-tower/route.ts | kode |
| `intelligence/scaleDecision.ts` | **KEEP** | 112 | Transitive KEEP fra prod-closure (intelligence/index.ts). | ingen | ingen-ekstern |
| `intelligence/scalePolicy.ts` | **KEEP** | 86 | Transitive KEEP fra prod-closure (intelligence/index.ts). | ingen | ingen-ekstern |
| `intelligence/signals.ts` | **KEEP** | 153 | Transitive KEEP fra prod-closure (intelligence/index.ts). | ingen | ingen-ekstern |
| `intelligence/store.ts` | **KEEP** | 217 | Deterministisk: ≥1 ekstern consumer (lib/observability/eventLogger.ts +12). | lib/observability/eventLogger.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/intelligence/events/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/content/pages/[id]/variant/publish/route.ts; app/api/backoffice/experiments/[id]/route.ts (+10) | kode,scheduled,tests,docs |
| `intelligence/systemIntelligence.ts` | **REFACTOR** | 71 | Deterministisk: ≥1 ekstern consumer (app/api/ai/decision/route.ts +7). | app/api/ai/decision/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/intelligence/dashboard/route.ts; app/api/backoffice/ai/intelligence/events/route.ts; app/api/backoffice/ai/intelligence/query/route.ts (+9) | kode,docs |
| `intelligence/trends.ts` | **KEEP** | 95 | Transitive KEEP fra prod-closure (intelligence/index.ts). | ingen | ingen-ekstern |
| `intelligence/types.ts` | **KEEP** | 80 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/intelligence/page.tsx +3). | app/(backoffice)/backoffice/intelligence/page.tsx; lib/observability/eventLogger.ts; app/(backoffice)/backoffice/intelligence/page.tsx; app/(backoffice)/backoffice/intelligence/page.tsx | kode |
| `jobs/backoff.ts` | **KEEP** | 12 | Transitive KEEP fra prod-closure (jobs/runner.ts). | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md; docs/strategy/ai-feature-inventory-2026-05-26.md | docs |
| `jobs/claim.ts` | **KEEP** | 49 | Transitive KEEP fra prod-closure (jobs/runner.ts). | docs/db-cleanup-report.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `jobs/runner.ts` | **KEEP** | 227 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/jobs/run/route.ts +2). | app/api/backoffice/ai/jobs/run/route.ts; app/api/backoffice/ai/jobs/run/route.ts; app/api/backoffice/ai/jobs/run/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `keywords.ts` | **KEEP** | 41 | Deterministisk: ≥1 ekstern consumer (studio/lunchportalen-studio/package.json +1). | studio/lunchportalen-studio/package.json; studio/package.json | cms |
| `layout.ts` | **KEEP** | 67 | Deterministisk: ≥1 ekstern consumer (lib/moo/generateVariant.ts +24). | lib/moo/generateVariant.ts; lib/moo/generateVariantsDiverse.ts; app/api/ai/layout/route.ts; lib/cms/backofficeBlockCatalog.ts; lib/cms/blocks/blockTypeDefinitions.ts; lib/cms/design/designContract.ts (+31) | kode,scheduled,tests,cms,docs |
| `layoutRules.ts` | **KEEP** | 32 | Deterministisk: ≥1 ekstern consumer (lib/hooks/useAiPageBuilder.ts +2). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts | kode |
| `learning.ts` | **KEEP** | 211 | Deterministisk: ≥1 ekstern consumer (lib/pos/learningRouter.ts +16). | lib/pos/learningRouter.ts; lib/pos/posAdaptivePersistence.ts; app/api/ai/insights/route.ts; app/api/ai/learn/route.ts; lib/global/learningStore.ts; lib/global/runGlobalLearningCycle.ts (+13) | kode,docs |
| `learningBySurface.ts` | **KEEP** | 41 | Transitive KEEP fra prod-closure (crossSurfaceLearning.ts). | ingen | ingen-ekstern |
| `logActivity.ts` | **KEEP** | 74 | Deterministisk: ≥1 ekstern consumer (app/api/ai/analyze/route.ts +20). | app/api/ai/analyze/route.ts; app/api/ai/block/route.ts; app/api/ai/experiments/route.ts; app/api/ai/generate/route.ts; app/api/ai/optimize/route.ts; app/api/ai/page/audit/route.ts (+15) | kode |
| `logging/aiActivityLogRow.ts` | **KEEP** | 99 | Deterministisk: ≥1 ekstern consumer (lib/audit/aiActivityAudit.ts +200). | lib/audit/aiActivityAudit.ts; lib/autonomy/audit.ts; lib/autonomy/override.ts; lib/autonomy/runRevenue.ts; lib/autopilot/experimentProposal.ts; lib/autopilot/log.ts (+198) | kode,scheduled,docs |
| `logging/aiExecutionLog.ts` | **KEEP** | 117 | Deterministisk: ≥1 ekstern consumer (lib/alerts/dispatcher.ts +20). | lib/alerts/dispatcher.ts; lib/autonomy/engine.ts; lib/social/observability.ts; app/api/superadmin/control-tower/autopilot/route.ts; app/api/superadmin/control-tower/scale/route.ts; app/superadmin/control-tower/actions.ts (+19) | kode,docs |
| `logging/insertAiActivityLogCompat.ts` | **KEEP** | 58 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/suggest/route.ts +2). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts | kode |
| `marketSignals.ts` | **KEEP** | 56 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +2). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx | kode |
| `memory/aiMemory.ts` | **KEEP** | 162 | Transitive KEEP fra prod-closure (attribution/storeAttribution.ts). | docs/ai-engine/AI_MEMORY_LEARNING.md; docs/ai-engine/AI_MEMORY_LEARNING.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `memory/recordOutcome.ts` | **KEEP** | 137 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/apply/route.ts +17). | app/api/backoffice/ai/apply/route.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/design-suggestion/log-apply/route.ts; app/api/backoffice/ai/seo-intelligence/route.ts; app/api/backoffice/content/pages/[id]/variant/publish/route.ts; app/api/backoffice/releases/[id]/execute/route.ts (+18) | kode,docs |
| `memoryDecay.ts` | **KEEP** | 9 | Transitive KEEP fra prod-closure (experienceModel.ts). | ingen | ingen-ekstern |
| `menuToIngredients.ts` | **KEEP** | 170 | Deterministisk: ≥1 ekstern consumer (app/api/admin/operations-tower/route.ts +2). | app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; docs/audit/lib-ai-decision.md | kode,docs |
| `metrics.ts` | **KEEP** | 60 | Deterministisk: ≥1 ekstern consumer (lib/autopilot/engine.ts +45). | lib/autopilot/engine.ts; lib/social/analyticsAggregate.ts; app/superadmin/system-graph/SystemGraphClient.tsx; scripts/k6/results/2026-05-23T18-28-55-217Z-summary-export.json; scripts/k6/results/2026-05-23T18-29-43-427Z-summary-export.json; scripts/k6/results/2026-05-23T18-30-11-789Z-summary-export.json (+40) | kode,scheduled |
| `normalizeCmsBlocks.ts` | **KEEP** | 168 | Deterministisk: ≥1 ekstern consumer (lib/hooks/useAiPageBuilder.ts +2). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts | kode |
| `objectionInsights.ts` | **KEEP** | 28 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +2). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx | kode |
| `operationsFeedback.ts` | **KEEP** | 59 | Deterministisk: ≥1 ekstern consumer (app/api/admin/operations-tower/route.ts +2). | app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; docs/audit/lib-ai-decision.md; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `opportunities.ts` | **KEEP** | 144 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +8). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; lib/autopilot/engine.ts; lib/autopilot/index.ts; lib/autopilot/opportunities.ts; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+5) | kode,docs |
| `optimize.ts` | **KEEP** | 65 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/autonomy/optimize/route.ts +5). | app/api/backoffice/autonomy/optimize/route.ts; app/api/ai/optimize/route.ts; app/api/backoffice/autonomy/optimize/route.ts; app/api/backoffice/autonomy/optimize/route.ts; scripts/buildTasks.ts; tests/ai/controlLayer.test.ts (+6) | kode,scheduled,tests,cms,docs |
| `optimizer.ts` | **KEEP** | 111 | Deterministisk: ≥1 ekstern consumer (app/api/ai/optimize/route.ts +4). | app/api/ai/optimize/route.ts; lib/growth/aggregateGrowth.ts; lib/growth/winner.ts; app/api/ai/optimize/route.ts; app/api/ai/optimize/route.ts | kode |
| `orchestration.ts` | **KEEP** | 150 | Deterministisk: ≥1 ekstern consumer (lib/pos/orchestrator.ts +2). | lib/pos/orchestrator.ts; lib/pos/orchestrator.ts; lib/pos/orchestrator.ts | kode |
| `outcomeEvaluator.ts` | **CUT** | 23 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `pageBuilder.ts` | **REFACTOR** | 172 | Deterministisk: ≥1 ekstern consumer (lib/moo/generateVariant.ts +15). | lib/moo/generateVariant.ts; lib/moo/generateVariantsDiverse.ts; app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/api/ai/page/route.ts; lib/hooks/useAiPageBuilder.ts; lib/moo/generateVariant.ts (+19) | kode,docs |
| `pageBuilderPrompts.ts` | **KEEP** | 96 | Transitive KEEP fra prod-closure (cmsAiEngine.ts). | ingen | ingen-ekstern |
| `pageInsightLog.ts` | **KEEP** | 72 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx +2). | app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx | kode |
| `pageIntent.ts` | **KEEP** | 122 | Deterministisk: ≥1 ekstern consumer (lib/hooks/useAiPageBuilder.ts +4). | lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; lib/hooks/useAiPageBuilder.ts; app/(backoffice)/backoffice/content/_components/contentWorkspaceRightRailSlots.ts; app/(backoffice)/backoffice/content/_components/contentWorkspaceRightRailViewModel.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md (+3) | kode,docs |
| `pageScore.ts` | **KEEP** | 149 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +5). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx | kode |
| `performance.ts` | **KEEP** | 54 | Deterministisk: ≥1 ekstern consumer (lib/revenue/aiRevenueAttribution.ts +7). | lib/revenue/aiRevenueAttribution.ts; lib/revenue/aiRevenueAttribution.ts; lib/revenue/aiRevenueAttribution.ts; lib/scale/budget.ts; lib/scale/markets.ts; lib/scale/reallocate.ts (+2) | kode,scheduled |
| `policy.ts` | **KEEP** | 22 | Deterministisk: ≥1 ekstern consumer (lib/execution/run.ts +5). | lib/execution/run.ts; lib/cms/backofficeExtensionRegistry.ts; lib/cms/backofficeSettingsWorkspaceModel.ts; lib/execution/run.ts; lib/execution/run.ts; lib/pos/executionRouter.ts (+1) | kode,docs |
| `policyEngine.ts` | **KEEP** | 199 | Deterministisk: ≥1 ekstern consumer (lib/pos/executionRouter.ts +4). | lib/pos/executionRouter.ts; lib/autonomy/orchestrator.ts; lib/neural/model.ts; lib/pos/executionRouter.ts; lib/pos/executionRouter.ts; docs/audit/lib-ai-decision.md | kode,docs |
| `portionAllocation.ts` | **KEEP** | 34 | Deterministisk: ≥1 ekstern consumer (app/api/admin/operations-tower/route.ts +2). | app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; app/api/admin/operations-tower/route.ts; docs/audit/lib-ai-decision.md; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `pre-evaluate.ts` | **KEEP** | 42 | Deterministisk: ≥1 ekstern consumer (lib/autopilot/engine.ts +2). | lib/autopilot/engine.ts; lib/autopilot/engine.ts; lib/autopilot/engine.ts | kode |
| `predictiveModel.ts` | **KEEP** | 42 | Deterministisk: ≥1 ekstern consumer (lib/pipeline/enrichDeal.ts +3). | lib/pipeline/enrichDeal.ts; lib/pipeline/predict.ts; lib/pipeline/predictAdvanced.ts; lib/pipeline/runPrediction.ts; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/phase2-ai-inventory-2026-05-26.md | kode,docs |
| `predictiveRiskEngine.ts` | **CUT** | 17 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `predictor.ts` | **KEEP** | 75 | Deterministisk: ≥1 ekstern consumer (lib/autopilot/engine.ts +2). | lib/autopilot/engine.ts; lib/autopilot/engine.ts; lib/autopilot/engine.ts | kode |
| `pricing.ts` | **KEEP** | 83 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +39). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; lib/autonomy/validator.ts; lib/cms/blocks/blockEditorDataTypes.ts; lib/cms/blocks/blockEntryContract.ts; lib/cms/blocks/blockTypeDefinitions.ts; lib/cms/blockTypeMap.ts (+65) | kode,tests,docs |
| `pricing/engine.ts` | **KEEP** | 80 | Transitive KEEP fra prod-closure (enterprise/buildDashboardPayload.ts). | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `prioritization.ts` | **KEEP** | 10 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +5). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx | kode |
| `profit/engine.ts` | **KEEP** | 137 | Deterministisk: ≥1 ekstern consumer (lib/ads/profit.ts +2). | lib/ads/profit.ts; lib/ads/profitClassifier.ts; lib/ads/profitExecution.ts; tests/ads/profit-first.test.ts | kode,tests |
| `profit/profitState.ts` | **KEEP** | 61 | Transitive KEEP fra prod-closure (profit/engine.ts). | docs/strategy/phase2-ai-inventory-2026-05-26.md | docs |
| `profitability.ts` | **KEEP** | 274 | Deterministisk: transitiv via runner.ts (prod LLM path) — CUT ville bryte runner. | docs/strategy/ai-feature-inventory-2026-05-26.md | docs |
| `prompts.ts` | **KEEP** | 40 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/image-generator/route.ts). | app/api/backoffice/ai/image-generator/route.ts; docs/strategy/ai-feature-inventory-2026-05-26.md | kode,docs |
| `rateLimit.ts` | **KEEP** | 104 | Deterministisk: ≥1 ekstern consumer (lib/email/send.ts +44). | lib/email/send.ts; lib/security/rateLimit.ts; app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cta-improve/route.ts; app/api/backoffice/ai/page-builder/route.ts (+43) | kode,docs |
| `recommendationActions.ts` | **KEEP** | 1028 | Deterministisk: ≥1 ekstern consumer (app/api/ai/recommendation/apply/route.ts +5). | app/api/ai/recommendation/apply/route.ts; app/api/ai/usage/route.ts; app/api/ai/recommendation/apply/route.ts; app/api/ai/recommendation/apply/route.ts; app/api/ai/usage/route.ts; app/api/ai/usage/route.ts (+1) | kode,docs |
| `recommendations.ts` | **KEEP** | 49 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/autonomy/recommendations/route.ts +8). | app/api/backoffice/autonomy/recommendations/route.ts; lib/ceo/buildSnapshot.ts; lib/social/recommendations.ts; app/(backoffice)/backoffice/autonomy/page.tsx; app/api/backoffice/autonomy/recommendations/route.ts; app/api/backoffice/autonomy/recommendations/route.ts (+3) | kode |
| `resolveAiSuggestionFkIds.ts` | **KEEP** | 61 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/suggest/route.ts +2). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts | kode |
| `resolveRunnerCompanyForBackoffice.ts` | **KEEP** | 39 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts +5). | app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/api/auth/me/route.ts; app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/(backoffice)/backoffice/content/_actions/generateAiPageDraft.ts; app/api/auth/me/route.ts; app/api/auth/me/route.ts (+2) | kode,tests |
| `resources/actionCost.ts` | **CUT** | 28 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `resources/capacityEngine.ts` | **CUT** | 42 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `resources/matchEngine.ts` | **CUT** | 19 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `resources/resourceModel.ts` | **KEEP** | 35 | Deterministisk: ≥1 ekstern consumer (supabase/migrations/20260429260000_ai_memory_resource_allocation_kind.sql). | supabase/migrations/20260429260000_ai_memory_resource_allocation_kind.sql; docs/audit/current-menu-architecture.md; docs/audit/tpt-b-7b-hotfix-4.md; docs/strategy/esg-engine-design-2026-05-26.md | scheduled,docs |
| `resources/resourceOrchestrator.ts` | **CUT** | 26 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `resources/scheduler.ts` | **CUT** | 15 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `responseSafety.ts` | **KEEP** | 142 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/block-builder/route.ts +26). | app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cta-improve/route.ts; app/api/backoffice/ai/design-optimizer/analyze/route.ts; app/api/backoffice/ai/image-metadata/route.ts; app/api/backoffice/ai/layout-suggestions/route.ts (+21) | kode |
| `retention/engine.ts` | **KEEP** | 62 | Transitive KEEP fra prod-closure (enterprise/buildDashboardPayload.ts). | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `revenue/analyzePerformance.ts` | **KEEP** | 143 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/revenue/insights/route.ts +2). | app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts | kode |
| `revenue/applyRevenueActions.ts` | **KEEP** | 79 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/revenue/insights/route.ts +2). | app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts | kode |
| `revenue/attribution.ts` | **KEEP** | 108 | Transitive KEEP fra prod-closure (enterprise/buildDashboardPayload.ts). | ingen | ingen-ekstern |
| `revenue/decisionEngine.ts` | **KEEP** | 94 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/revenue/insights/route.ts +5). | app/api/backoffice/revenue/insights/route.ts; tests/ai/revenue/decisionEngine.test.ts; lib/revenue/actions.ts; lib/revenue/optimize.ts; app/(backoffice)/backoffice/content/_components/EditorRevenueInsightsPanel.tsx; app/api/backoffice/revenue/insights/route.ts (+3) | kode,tests |
| `revenue/policy.ts` | **KEEP** | 75 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/revenue/insights/route.ts +2). | app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts; app/api/backoffice/revenue/insights/route.ts | kode |
| `rewrite.ts` | **KEEP** | 61 | Deterministisk: ≥1 ekstern consumer (app/api/ai/rewrite/route.ts +9). | app/api/ai/rewrite/route.ts; app/(backoffice)/backoffice/ai/editor-verification/page.tsx; app/(backoffice)/backoffice/content/_components/BlockInspectorShell.tsx; app/(backoffice)/backoffice/content/_components/InlineAiActions.tsx; app/(backoffice)/backoffice/content/_components/useContentWorkspaceRichTextAi.ts; app/api/ai/rewrite/route.ts (+10) | kode,scheduled,tests,docs |
| `roadmapEngine.ts` | **KEEP** | 34 | Deterministisk: ≥1 ekstern consumer (lib/strategy/roadmap.ts +1). | lib/strategy/roadmap.ts; lib/strategy/run.ts | kode |
| `role.ts` | **KEEP** | 23 | Deterministisk: ≥1 ekstern consumer (lib/growth/growthAttributionInsights.ts +69). | lib/growth/growthAttributionInsights.ts; lib/leads/createLead.ts; lib/leads/types.ts; lib/outbound/normalizeSegment.ts; lib/social/attribution.ts; lib/social/b2bLeadMessaging.ts (+65) | kode,scheduled,tests,cms |
| `run.ts` | **KEEP** | 88 | Deterministisk: ≥1 ekstern consumer (lib/acquire/strategy.ts +46). | lib/acquire/strategy.ts; lib/exit/outreach.ts; lib/exit/strategy.ts; lib/market/dominate.ts; lib/market/domination.ts; lib/market/message.ts (+48) | kode,scheduled,tests,docs |
| `runner.ts` | **REFACTOR** | 569 | Deterministisk: ≥1 ekstern consumer (lib/sales/messageGenerator.ts +50). | lib/sales/messageGenerator.ts; app/api/ai/block/route.ts; app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/capability/route.ts; app/api/backoffice/ai/cms-menu/route.ts; app/api/backoffice/ai/cta-improve/route.ts (+68) | kode,scheduled,tests,docs |
| `runnerGovernance.ts` | **KEEP** | 382 | Deterministisk: ≥1 ekstern consumer (app/api/ai/business-engine/route.ts +8). | app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/ai/business-engine/route.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts (+5) | kode,tests |
| `safeApply.ts` | **KEEP** | 57 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx +2). | app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx; app/(backoffice)/backoffice/content/_components/EditorPageInsightsPanel.tsx | kode |
| `safety/aiSafetyFilter.ts` | **KEEP** | 156 | Deterministisk: ≥1 ekstern consumer (app/api/system/ai/diagnostics/route.ts +2). | app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | kode,docs |
| `schema/errors.ts` | **KEEP** | 52 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/design-optimizer/apply/route.ts +11). | app/api/backoffice/ai/design-optimizer/apply/route.ts; app/api/backoffice/ai/intelligence/events/route.ts; app/api/backoffice/company/control-tower/route.ts; app/api/backoffice/revenue/insights/route.ts; tests/ai/schema.test.ts; app/api/backoffice/ai/design-optimizer/apply/route.ts (+9) | kode,tests |
| `schema/events.ts` | **KEEP** | 46 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/intelligence/events/route.ts). | app/api/backoffice/ai/intelligence/events/route.ts | kode |
| `schema/index.ts` | **KEEP** | 45 | Transitive KEEP fra prod-closure (intelligence/index.ts). | ingen | ingen-ekstern |
| `schema/payloads.ts` | **KEEP** | 275 | Transitive KEEP fra prod-closure (schema/index.ts). | ingen | ingen-ekstern |
| `schema/schemaRef.ts` | **KEEP** | 9 | Transitive KEEP fra prod-closure (responseSafety.ts). | ingen | ingen-ekstern |
| `schema/validate.ts` | **KEEP** | 218 | Transitive KEEP fra prod-closure (intelligence/store.ts). | tests/ai/schema.test.ts; tests/ai/schema.test.ts; tests/ai/schema.test.ts | tests |
| `segmentation/engine.ts` | **KEEP** | 88 | Transitive KEEP fra prod-closure (enterprise/buildDashboardPayload.ts). | ingen | ingen-ekstern |
| `seoAnalyzer.ts` | **KEEP** | 159 | Transitive KEEP fra prod-closure (copilot.ts). | ingen | ingen-ekstern |
| `seoEngine.ts` | **KEEP** | 142 | Deterministisk: ≥1 ekstern consumer (app/api/ai/growth/seo/route.ts +2). | app/api/ai/growth/seo/route.ts; app/api/ai/growth/seo/route.ts; app/api/ai/growth/seo/route.ts; docs/phase2d/SEO_SOURCE_OF_TRUTH.md | kode,docs |
| `signalEngine.ts` | **KEEP** | 18 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx | kode |
| `signals.ts` | **KEEP** | 62 | Deterministisk: ≥1 ekstern consumer (lib/pitch/data.ts +7). | lib/pitch/data.ts; app/api/backoffice/control-tower/route.ts; lib/pitch/data.ts; lib/pitch/data.ts; lib/pos/index.ts; lib/pos/signalCollector.ts (+2) | kode |
| `simulator.ts` | **KEEP** | 59 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +2). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx | kode |
| `siteAnalysis.ts` | **KEEP** | 122 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +5). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx | kode |
| `siteGrowthLog.ts` | **KEEP** | 32 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx +2). | app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx; app/(backoffice)/backoffice/content/_workspace/GrowthDashboard.tsx | kode |
| `socialStrategy.ts` | **KEEP** | 42 | Deterministisk: ≥1 ekstern consumer (lib/forecast/controlTowerPlan.ts +74). | lib/forecast/controlTowerPlan.ts; lib/pricing/superadminViews.ts; lib/procurement/plan.ts; lib/product/adCampaignEconomicsGate.ts; lib/product/growthProductViews.ts; lib/product/socialRefEconomics.ts (+78) | kode,tests |
| `strategicCeoDecision.ts` | **KEEP** | 30 | Deterministisk: ≥1 ekstern consumer (lib/autopilot/engine.ts +2). | lib/autopilot/engine.ts; lib/autopilot/engine.ts; lib/autopilot/engine.ts | kode |
| `strategicContext.ts` | **KEEP** | 76 | Transitive KEEP fra prod-closure (strategyEngine.ts). | ingen | ingen-ekstern |
| `strategicPrioritizer.ts` | **CUT** | 20 | Deterministisk: 0 eksterne consumers etter full crawl + A.5 supplement. | ingen | ingen-ekstern |
| `strategyEngine.ts` | **KEEP** | 264 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx +6). | app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; lib/acquire/strategy.ts; lib/strategy/actions.ts; lib/strategy/run.ts; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx; app/(backoffice)/backoffice/content/_components/AiCeoPanel.tsx (+1) | kode |
| `strictBlockValidator.ts` | **KEEP** | 83 | Transitive KEEP fra prod-closure (validateComponentOutput.ts). | ingen | ingen-ekstern |
| `suggestMotor.ts` | **KEEP** | 391 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/suggest/route.ts +2). | app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; app/api/backoffice/ai/suggest/route.ts; docs/ai-editor/verification-map-and-status.md; docs/ai-editor/verification-map-and-status.md; docs/audit/lib-ai-decision.md | kode,docs |
| `systemState.ts` | **KEEP** | 35 | Transitive KEEP fra prod-closure (signalEngine.ts). | ingen | ingen-ekstern |
| `tools/abGenerateVariants.ts` | **KEEP** | 257 | Transitive KEEP fra prod-closure (suggestMotor.ts). | docs/ai-engine/EXPERIMENT_CRO_FLOW.md; docs/ai-engine/EXPERIMENT_CRO_FLOW.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `tools/blockBuilder.ts` | **KEEP** | 186 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/block-builder/route.ts +5). | app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/screenshot-builder/route.ts; app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/block-builder/route.ts; app/api/backoffice/ai/screenshot-builder/route.ts; app/api/backoffice/ai/screenshot-builder/route.ts (+5) | kode,tests,docs |
| `tools/contentMaintainPage.ts` | **KEEP** | 257 | Transitive KEEP fra prod-closure (jobs/runner.ts). | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `tools/imageGenerateBrandSafe.ts` | **KEEP** | 74 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/image-generator/route.ts +2). | app/api/backoffice/ai/image-generator/route.ts; app/api/backoffice/ai/image-generator/route.ts; app/api/backoffice/ai/image-generator/route.ts; tests/api/backofficeAiImageRoutes.test.ts; tests/api/backofficeAiImageRoutes.test.ts; docs/backoffice/CMS_EDITOR_AUDIT_AND_ARCHITECTURE.md (+8) | kode,tests,docs |
| `tools/imageImproveMetadata.ts` | **KEEP** | 100 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/image-metadata/route.ts +2). | app/api/backoffice/ai/image-metadata/route.ts; app/api/backoffice/ai/image-metadata/route.ts; app/api/backoffice/ai/image-metadata/route.ts; tests/api/backofficeAiImageRoutes.test.ts; tests/api/backofficeAiImageRoutes.test.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md (+1) | kode,tests,docs |
| `tools/landingGenerateSections.ts` | **KEEP** | 159 | Transitive KEEP fra prod-closure (jobs/runner.ts). | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `tools/layoutSuggestions.ts` | **KEEP** | 320 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/layout-suggestions/route.ts +2). | app/api/backoffice/ai/layout-suggestions/route.ts; app/api/backoffice/ai/layout-suggestions/route.ts; app/api/backoffice/ai/layout-suggestions/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md; docs/reports/PLATFORM_100_PERCENT_REPORT.md (+1) | kode,docs |
| `tools/pageBuilder.ts` | **KEEP** | 292 | Deterministisk: ≥1 ekstern consumer (app/api/backoffice/ai/page-builder/route.ts +4). | app/api/backoffice/ai/page-builder/route.ts; tests/ai/pageBuilderDraft.test.ts; tests/ai/providerFallback.test.ts; tests/lib/ai/pageBuilder.test.ts; app/(backoffice)/backoffice/content/_components/editorAiContracts.ts; app/(backoffice)/backoffice/content/_components/EDITOR_AI_CONTRACT_MODEL.md (+17) | kode,tests,docs |
| `tools/registry.ts` | **KEEP** | 120 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/contentWorkspace.ai.ts +12). | app/(backoffice)/backoffice/content/_components/contentWorkspace.ai.ts; app/api/backoffice/ai/suggest/route.ts; app/api/system/ai/diagnostics/route.ts; app/api/system/ai/health/route.ts; tests/ai/seoToolPolicy.test.ts; app/(backoffice)/backoffice/content/_components/contentWorkspace.ai.ts (+15) | kode,tests,docs |
| `tools/seoOptimizePage.ts` | **KEEP** | 162 | Transitive KEEP fra prod-closure (jobs/runner.ts). | docs/FULL_REPOSITORY_AUDIT_VERIFIED.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md; docs/reports/PLATFORM_100_PERCENT_REPORT.md; docs/reports/PLATFORM_100_PERCENT_REPORT.md | docs |
| `tools/translateBlocks.ts` | **KEEP** | 143 | Transitive KEEP fra prod-closure (jobs/runner.ts). | docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md | docs |
| `tracking.ts` | **KEEP** | 81 | Deterministisk: ≥1 ekstern consumer (app/api/ai/track/route.ts +2). | app/api/ai/track/route.ts; app/api/ai/track/route.ts; app/api/ai/track/route.ts | kode |
| `transientAiJsonCache.ts` | **KEEP** | 46 | Transitive KEEP fra prod-closure (pageBuilder.ts). | ingen | ingen-ekstern |
| `types.ts` | **KEEP** | 93 | Deterministisk: ≥1 ekstern consumer (lib/pos/signalCollector.ts +5). | lib/pos/signalCollector.ts; app/api/ai/copilot/route.ts; lib/pos/signalCollector.ts; app/api/ai/copilot/route.ts; app/api/ai/copilot/route.ts; scripts/seed/tsconfig.json | kode,scheduled |
| `usage.ts` | **KEEP** | 229 | Deterministisk: ≥1 ekstern consumer (app/api/ai/usage/route.ts +6). | app/api/ai/usage/route.ts; lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; app/api/ai/usage/route.ts; docs/strategy/ai-feature-inventory-2026-05-26.md (+7) | kode,docs |
| `usageOverview.ts` | **KEEP** | 273 | Deterministisk: ≥1 ekstern consumer (lib/pos/signalCollector.ts +8). | lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts; app/api/ai/usage/route.ts; lib/pos/signalCollector.ts; lib/pos/signalCollector.ts; app/api/ai/business-engine/route.ts (+3) | kode |
| `validate.ts` | **KEEP** | 62 | Deterministisk: ≥1 ekstern consumer (app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx +2). | app/(backoffice)/backoffice/content/_components/EditorAiPanel.tsx; app/api/backoffice/ai/cms-menu/route.ts; scripts/validate.ts; docs/strategy/ai-feature-inventory-2026-05-26.md | kode,scheduled,docs |
| `validateComponentOutput.ts` | **KEEP** | 82 | Transitive KEEP fra prod-closure (blockSchema.ts). | ingen | ingen-ekstern |
| `validation/validateAiOutput.ts` | **KEEP** | 203 | Deterministisk: ≥1 ekstern consumer (app/api/system/ai/diagnostics/route.ts +2). | app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; app/api/system/ai/diagnostics/route.ts; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00R2_FULL_FILE_CLASSIFICATION.md; docs/repo-audit/U00_FULL_FILE_CLASSIFICATION.md (+1) | kode,docs |
| `variantGenerator.ts` | **KEEP** | 145 | Deterministisk: ≥1 ekstern consumer (lib/content/variants.ts +2). | lib/content/variants.ts; lib/growth/domination.ts; lib/social/abGenerator.ts | kode |
| `wasteTracker.ts` | **REFACTOR** | 98 | Deterministisk: ≥1 ekstern consumer (app/api/admin/demand-insights/route.ts +2). | app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts; app/api/admin/demand-insights/route.ts; docs/audit/lib-ai-decision.md; docs/strategy/ai-feature-inventory-2026-05-26.md; docs/strategy/esg-engine-design-2026-05-26.md (+2) | kode,docs |

---

## CUT-grupperinger (Fase B rekkefølge — LOC desc)

### Dead /api/ai/* routes (ingen UI-fetch) (`dead-api-ai-routes`)

| Filer/ruter | LOC | PR-size | Tester re-run | Smoke |
|-------------|----:|---------|---------------|-------|
| 0 lib + 6 routes | 558 | S | `npm run test:run` | demand-forecast, demand-insights, backoffice AI |

**Lib:** —

**Routes:** `/api/ai/analyze`, `/api/ai/decision`, `/api/ai/experiments`, `/api/ai/insights`, `/api/ai/learn`, `/api/ai/optimize`


### Capital allocation (`capital-allocation-stubs`)

| Filer/ruter | LOC | PR-size | Tester re-run | Smoke |
|-------------|----:|---------|---------------|-------|
| 7 lib + 0 routes | 166 | S | `npm run test:run` | demand-forecast, demand-insights, backoffice AI |

**Lib:** `capital/actionPriority.ts`, `capital/allocationEngine.ts`, `capital/capitalOutput.ts`, `capital/executionEngine.ts`, `capital/executionPlan.ts`, `capital/riskEngine.ts`, `capital/roiEngine.ts`



### control/* + tests/ai/controlLayer.test.ts (`control-and-tests-dead`)

| Filer/ruter | LOC | PR-size | Tester re-run | Smoke |
|-------------|----:|---------|---------------|-------|
| 8 lib + 0 routes | 155 | S | `npm run test:run` | demand-forecast, demand-insights, backoffice AI |

**Lib:** `control/controlGate.ts`, `control/ethicsEngine.ts`, `control/explainEngine.ts`, `control/governanceEngine.ts`, `control/killSwitch.ts`, `control/normalizeControlType.ts`, `control/overrideEngine.ts`, `control/riskEngine.ts`


**Inkluder:** `tests/ai/controlLayer.test.ts`

### Pillar 1 deferred (Thomas A.5) (`pillar1-deferred-stubs`)

| Filer/ruter | LOC | PR-size | Tester re-run | Smoke |
|-------------|----:|---------|---------------|-------|
| 1 lib + 0 routes | 131 | S | `npm run test:run` | demand-forecast, demand-insights, backoffice AI |

**Lib:** `adaptiveScoring.ts`



### Resource orchestration (`resources-orchestration-stubs`)

| Filer/ruter | LOC | PR-size | Tester re-run | Smoke |
|-------------|----:|---------|---------------|-------|
| 5 lib + 0 routes | 130 | S | `npm run test:run` | demand-forecast, demand-insights, backoffice AI |

**Lib:** `resources/actionCost.ts`, `resources/capacityEngine.ts`, `resources/matchEngine.ts`, `resources/resourceOrchestrator.ts`, `resources/scheduler.ts`



### Attribution ROI (`attribution-roi-stubs`)

| Filer/ruter | LOC | PR-size | Tester re-run | Smoke |
|-------------|----:|---------|---------------|-------|
| 3 lib + 0 routes | 122 | S | `npm run test:run` | demand-forecast, demand-insights, backoffice AI |

**Lib:** `attribution/aggregationEngine.ts`, `attribution/insightEngine.ts`, `attribution/roiEngine.ts`



### Meta-engine root stubs (`meta-engines-root`)

| Filer/ruter | LOC | PR-size | Tester re-run | Smoke |
|-------------|----:|---------|---------------|-------|
| 3 lib + 0 routes | 60 | S | `npm run test:run` | demand-forecast, demand-insights, backoffice AI |

**Lib:** `outcomeEvaluator.ts`, `predictiveRiskEngine.ts`, `strategicPrioritizer.ts`




---

## app/api/ai/** — route classification (B.4 dynamic-fetch)

| Route | Class | LOC | Justification | Fetch consumers |
|-------|-------|----:|---------------|-----------------|
| `/api/ai/analyze` | **CUT** | 88 | 0 treff B.1–B.3 (fetch/SWR/Postman/docs partner-API) — dead-api-ai-routes. | ingen |
| `/api/ai/block` | **KEEP** | 177 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts (+1). | app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts; app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts |
| `/api/ai/block/score` | **KEEP** | 49 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceAi.ts |
| `/api/ai/business-engine` | **KEEP** | 154 | Dynamic fetch funnet: app/(backoffice)/backoffice/ai/overview/page.tsx. | app/(backoffice)/backoffice/ai/overview/page.tsx |
| `/api/ai/continue` | **KEEP** | 67 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts. | app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts |
| `/api/ai/copilot` | **KEEP** | 73 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceCopilot.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceCopilot.ts |
| `/api/ai/dashboard` | **KEEP** | 84 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts |
| `/api/ai/decision` | **CUT** | 134 | 0 treff B.1–B.3 (fetch/SWR/Postman/docs partner-API) — dead-api-ai-routes. | ingen |
| `/api/ai/design/analyze` | **KEEP** | 90 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceDesignAi.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceDesignAi.ts |
| `/api/ai/design/generate` | **KEEP** | 83 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceDesignAi.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceDesignAi.ts |
| `/api/ai/experiments` | **CUT** | 91 | 0 treff B.1–B.3 (fetch/SWR/Postman/docs partner-API) — dead-api-ai-routes. | ingen |
| `/api/ai/generate` | **KEEP** | 110 | Dynamic fetch funnet: lib/hooks/useAiPageBuilder.ts. | lib/hooks/useAiPageBuilder.ts |
| `/api/ai/growth/ads` | **KEEP** | 78 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts |
| `/api/ai/growth/funnel` | **KEEP** | 108 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts |
| `/api/ai/growth/seo` | **KEEP** | 107 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceGrowthAutonomyAi.ts |
| `/api/ai/image` | **KEEP** | 67 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts |
| `/api/ai/inline` | **KEEP** | 69 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts. | app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts |
| `/api/ai/insights` | **CUT** | 81 | 0 treff B.1–B.3 (fetch/SWR/Postman/docs partner-API) — dead-api-ai-routes. | ingen |
| `/api/ai/layout` | **KEEP** | 71 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts (+1). | app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts; lib/hooks/useAiPageBuilder.ts |
| `/api/ai/learn` | **CUT** | 69 | 0 treff B.1–B.3 (fetch/SWR/Postman/docs partner-API) — dead-api-ai-routes. | ingen |
| `/api/ai/optimize` | **CUT** | 95 | 0 treff B.1–B.3 (fetch/SWR/Postman/docs partner-API) — dead-api-ai-routes. | ingen |
| `/api/ai/page/audit` | **KEEP** | 76 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts |
| `/api/ai/page/build` | **KEEP** | 97 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts |
| `/api/ai/page` | **KEEP** | 71 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts |
| `/api/ai/recommendation/apply` | **KEEP** | 102 | Dynamic fetch funnet: app/(backoffice)/backoffice/ai/overview/page.tsx. | app/(backoffice)/backoffice/ai/overview/page.tsx |
| `/api/ai/recommendation/history` | **KEEP** | 43 | Dynamic fetch funnet: app/(backoffice)/backoffice/ai/overview/page.tsx. | app/(backoffice)/backoffice/ai/overview/page.tsx |
| `/api/ai/rewrite` | **KEEP** | 60 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts (+1). | app/(backoffice)/backoffice/content/_components/contentWorkspace.aiRequests.ts; lib/ai/editorRewrite.ts |
| `/api/ai` | **KEEP** | 19 | Dynamic fetch funnet: app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts. | app/(backoffice)/backoffice/content/_components/useContentWorkspaceShellModel.ts |
| `/api/ai/track` | **KEEP** | 56 | Dynamic fetch funnet: lib/ai/tracking.ts. | lib/ai/tracking.ts |
| `/api/ai/usage` | **KEEP** | 256 | Dynamic fetch funnet: app/(backoffice)/backoffice/ai/overview/page.tsx. | app/(backoffice)/backoffice/ai/overview/page.tsx |

**Merk:** `/api/ai/automation` kalles fra UI men **route finnes ikke** — dead client call (fikses i Phase 3+, ikke Fase B lib-sletting).

---

## REFACTOR (Phase 3+)

Se [phase2-refactor-backlog-2026-05-26.md](./phase2-refactor-backlog-2026-05-26.md).

---

## STOP — FASE A.5 complete · klar for Fase B

*Generated READ-ONLY · `scripts/audit/phase2-cut-list-a55-complete.mjs`*
