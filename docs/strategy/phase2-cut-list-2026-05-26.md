# Phase 2 — Cut-list classification (FASE A)

**Date:** 2026-05-26  
**Mode:** READ-ONLY · no deletions until Thomas review  
**Baseline:** [phase2-ai-inventory-2026-05-26.md](./phase2-ai-inventory-2026-05-26.md)

---

## Executive summary

| Scope | Files | LOC |
|-------|------:|----:|
| `lib/ai/**/*.ts` | **277** | **29570** |
| `app/api/ai/**/route.ts` | **30** | **2725** |

### `lib/ai` by class

| Class | Files | LOC | Meaning |
|-------|------:|----:|---------|
| **KEEP** | 181 | 22261 | Prod path → 200 (live P2 or backoffice CMS) |
| **CUT** | 36 | 1053 | No prod consumer; not P2/ESG — atomic delete in Phase B |
| **REFACTOR** | 16 | 3017 | Keep but tighten (note in table) |
| **INVESTIGATE** | 44 | 3239 | Uncertain — review before delete |

### `app/api/ai/**` routes by class

| Class | Routes | LOC |
|-------|-------:|----:|
| **KEEP** | 1 | 256 |
| **CUT** | 5 | 520 |
| **REFACTOR** | 0 | 0 |
| **INVESTIGATE** | 24 | 1949 |

**Live P2 (not under `/api/ai/`):** `/api/kitchen/demand-forecast`, `/api/admin/demand-insights`, `/api/admin/operations-tower` → **KEEP** via `lib/ai` closure.

**Baseline delta:** inventory cited **279** files; crawl **277** `.ts` paths.

---

## CUT groups (Phase B atomic deletion)

Order: drop **importer routes** first, then **lib groups** bottom-up.

### Capital / allocation stubs (Pillar 1) (`capital-allocation-stubs`)

| Files | LOC |
|-------|----:|
| 10 | 269 |

- `capital/actionGenerator.ts` (23 LOC)
- `capital/actionPriority.ts` (14 LOC)
- `capital/allocationEngine.ts` (43 LOC)
- `capital/capitalOutput.ts` (27 LOC)
- `capital/capitalState.ts` (69 LOC)
- `capital/executionEngine.ts` (20 LOC)
- `capital/executionPlan.ts` (18 LOC)
- `capital/investmentAreas.ts` (11 LOC)
- `capital/riskEngine.ts` (22 LOC)
- `capital/roiEngine.ts` (22 LOC)

### Meta-engines (root stubs) (`meta-engines-core`)

| Files | LOC |
|-------|----:|
| 8 | 254 |

- `crossSurfaceLearning.ts` (44 LOC)
- `experienceModel.ts` (65 LOC)
- `memoryDecay.ts` (9 LOC)
- `outcomeEvaluator.ts` (23 LOC)
- `predictiveModel.ts` (42 LOC)
- `predictiveRiskEngine.ts` (17 LOC)
- `roadmapEngine.ts` (34 LOC)
- `strategicPrioritizer.ts` (20 LOC)

### Orphan — zero prod/lib importers (`orphan-unwired`)

| Files | LOC |
|-------|----:|
| 9 | 243 |

- `control/controlGate.ts` (49 LOC)
- `control/ethicsEngine.ts` (15 LOC)
- `control/explainEngine.ts` (18 LOC)
- `control/governanceEngine.ts` (18 LOC)
- `control/killSwitch.ts` (11 LOC)
- `control/normalizeControlType.ts` (19 LOC)
- `control/overrideEngine.ts` (12 LOC)
- `control/riskEngine.ts` (13 LOC)
- `editorRewrite.ts` (88 LOC)

### Resource orchestration stubs (`resources-orchestration-stubs`)

| Files | LOC |
|-------|----:|
| 6 | 165 |

- `resources/actionCost.ts` (28 LOC)
- `resources/capacityEngine.ts` (42 LOC)
- `resources/matchEngine.ts` (19 LOC)
- `resources/resourceModel.ts` (35 LOC)
- `resources/resourceOrchestrator.ts` (26 LOC)
- `resources/scheduler.ts` (15 LOC)

### Attribution ROI stubs (`attribution-roi-stubs`)

| Files | LOC |
|-------|----:|
| 3 | 122 |

- `attribution/aggregationEngine.ts` (62 LOC)
- `attribution/insightEngine.ts` (19 LOC)
- `attribution/roiEngine.ts` (41 LOC)

---

## lib/ai — KEEP (181 files, 22261 LOC)

| File | LOC | Justification |
|------|----:|---------------|
| `actions/mapDecisionToAction.ts` | 104 | Supporting module in prod closure via lib hook or backoffice stack. |
| `adaptiveLearning.ts` | 914 | Imported by prod app route/component on path to user response. |
| `adaptiveScoring.ts` | 131 | Supporting module in prod closure via lib hook or backoffice stack. |
| `aiEntrypointContext.ts` | 50 | Transitive dependency of live P2 route (200 without LLM). |
| `aiPageGuardrails.ts` | 47 | Supporting module in prod closure via lib hook or backoffice stack. |
| `analysis/contentHealth.ts` | 72 | Supporting module in prod closure via lib hook or backoffice stack. |
| `attribution.ts` | 31 | Supporting module in prod closure via lib hook or backoffice stack. |
| `attribution/attributionModel.ts` | 47 | Imported by prod app route/component on path to user response. |
| `attribution/storeAttribution.ts` | 42 | Imported by prod app route/component on path to user response. |
| `audience.ts` | 23 | Supporting module in prod closure via lib hook or backoffice stack. |
| `autoImprove.ts` | 82 | Imported by prod app route/component on path to user response. |
| `batchApply.ts` | 145 | Imported by prod app route/component on path to user response. |
| `billing.ts` | 271 | Imported by prod app route/component on path to user response. |
| `blockFactory.ts` | 138 | Supporting module in prod closure via lib hook or backoffice stack. |
| `blockSchema.ts` | 411 | Supporting module in prod closure via lib hook or backoffice stack. |
| `buildHomeFromIntentBody.ts` | 131 | Imported by prod app route/component on path to user response. |
| `businessMetrics.ts` | 97 | Transitive dependency of live P2 route (200 without LLM). |
| `businessObjective.ts` | 985 | Imported by prod app route/component on path to user response. |
| `cmsAiActions.ts` | 14 | Imported by prod app route/component on path to user response. |
| `cmsAiPrompts.ts` | 105 | Supporting module in prod closure via lib hook or backoffice stack. |
| `cmsAiTenant.ts` | 50 | Imported by prod app route/component on path to user response. |
| `cmsAiTypes.ts` | 43 | Supporting module in prod closure via lib hook or backoffice stack. |
| `company/actionTypes.ts` | 62 | Supporting module in prod closure via lib hook or backoffice stack. |
| `company/anomaly.ts` | 69 | Supporting module in prod closure via lib hook or backoffice stack. |
| `company/automationEngine.ts` | 178 | Imported by prod app route/component on path to user response. |
| `company/decisionEngine.ts` | 135 | Supporting module in prod closure via lib hook or backoffice stack. |
| `company/memory.ts` | 48 | Imported by prod app route/component on path to user response. |
| `company/policyEngine.ts` | 244 | Imported by prod app route/component on path to user response. |
| `company/safety.ts` | 48 | Supporting module in prod closure via lib hook or backoffice stack. |
| `company/types.ts` | 106 | Imported by prod app route/component on path to user response. |
| `config.ts` | 41 | Supporting module in prod closure via lib hook or backoffice stack. |
| `context.ts` | 98 | Imported by prod app route/component on path to user response. |
| `context/systemContext.ts` | 92 | Imported by prod app route/component on path to user response. |
| `continuation.ts` | 66 | Imported by prod app route/component on path to user response. |
| `controlTower/actionRegistry.ts` | 25 | Imported by prod app route/component on path to user response. |
| `conversion/engine.ts` | 67 | Supporting module in prod closure via lib hook or backoffice stack. |
| `copilot.ts` | 92 | Imported by prod app route/component on path to user response. |
| `croAnalyzer.ts` | 97 | Supporting module in prod closure via lib hook or backoffice stack. |
| `ctaOptimizer.ts` | 11 | Supporting module in prod closure via lib hook or backoffice stack. |
| `dashboard.ts` | 88 | Imported by prod app route/component on path to user response. |
| `dashboardEngine.ts` | 232 | Imported by prod app route/component on path to user response. |
| `debounce.ts` | 14 | Imported by prod app route/component on path to user response. |
| `decisionEngine.ts` | 271 | Transitive dependency of live P2 route (200 without LLM). |
| `decisionId.ts` | 13 | Transitive dependency of live P2 route (200 without LLM). |
| `decisionLog.ts` | 56 | Imported by prod app route/component on path to user response. |
| `decisions.ts` | 39 | Supporting module in prod closure via lib hook or backoffice stack. |
| `demandData.ts` | 103 | Pillar 2/ESG core on live kitchen/admin route returning 200 without LLM. |
| `design/analyzeDesign.ts` | 135 | Core design/ infrastructure in prod import closure. |
| `design/applyDesignChanges.ts` | 103 | Core design/ infrastructure in prod import closure. |
| `design/designMetrics.ts` | 75 | Core design/ infrastructure in prod import closure. |
| `design/designPolicy.ts` | 116 | Core design/ infrastructure in prod import closure. |
| `design/designSettingsOptimizer.ts` | 312 | Core design/ infrastructure in prod import closure. |
| `design/lastDesignApply.ts` | 48 | Core design/ infrastructure in prod import closure. |
| `design/suggestDesignImprovements.ts` | 103 | Core design/ infrastructure in prod import closure. |
| `design/types.ts` | 55 | Core design/ infrastructure in prod import closure. |
| `designAnalyzer.ts` | 203 | Imported by prod app route/component on path to user response. |
| `designGenerator.ts` | 115 | Imported by prod app route/component on path to user response. |
| `designTokens.ts` | 71 | Imported by prod app route/component on path to user response. |
| `engine.ts` | 119 | Imported by prod app route/component on path to user response. |
| `enrichPageBuilderBlocks.ts` | 67 | Supporting module in prod closure via lib hook or backoffice stack. |
| `enterprise/buildDashboardPayload.ts` | 91 | Imported by prod app route/component on path to user response. |
| `enterprise/enterpriseLog.ts` | 48 | Imported by prod app route/component on path to user response. |
| `enterprise/pageInsights.ts` | 79 | Imported by prod app route/component on path to user response. |
| `entitlements.ts` | 39 | Supporting module in prod closure via lib hook or backoffice stack. |
| `evaluator.ts` | 36 | Supporting module in prod closure via lib hook or backoffice stack. |
| `evolve.ts` | 38 | Supporting module in prod closure via lib hook or backoffice stack. |
| `experiments/aiExperimentsRepo.ts` | 279 | Imported by prod app route/component on path to user response. |
| `experiments/analytics.ts` | 77 | Imported by prod app route/component on path to user response. |
| `experiments/revenueExperimentHints.ts` | 66 | Supporting module in prod closure via lib hook or backoffice stack. |
| `experimentWinnerDecision.ts` | 227 | Imported by prod app route/component on path to user response. |
| `fallbackHandler.ts` | 118 | Imported by prod app route/component on path to user response. |
| `feedback.ts` | 256 | Supporting module in prod closure via lib hook or backoffice stack. |
| `generateVariant.ts` | 31 | Supporting module in prod closure via lib hook or backoffice stack. |
| `generator.ts` | 99 | Imported by prod app route/component on path to user response. |
| `getClient.ts` | 19 | Supporting module in prod closure via lib hook or backoffice stack. |
| `ghostText.ts` | 27 | Imported by prod app route/component on path to user response. |
| `governance/aiPolicy.ts` | 124 | Core governance/ infrastructure in prod import closure. |
| `governanceApplySafety.ts` | 274 | Supporting module in prod closure via lib hook or backoffice stack. |
| `governor.ts` | 46 | Supporting module in prod closure via lib hook or backoffice stack. |
| `image.ts` | 51 | Imported by prod app route/component on path to user response. |
| `improveContent.ts` | 21 | Supporting module in prod closure via lib hook or backoffice stack. |
| `improvementEngine.ts` | 162 | Imported by prod app route/component on path to user response. |
| `industry.ts` | 25 | Imported by prod app route/component on path to user response. |
| `inline.ts` | 50 | Imported by prod app route/component on path to user response. |
| `insertAiSuggestionRow.ts` | 91 | Imported by prod app route/component on path to user response. |
| `insightsEngine.ts` | 59 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/confidence.ts` | 70 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/index.ts` | 98 | Imported by prod app route/component on path to user response. |
| `intelligence/learning.ts` | 73 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/patterns.ts` | 363 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/query.ts` | 89 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/scale.ts` | 291 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/scaleApply.ts` | 270 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/scaleDecision.ts` | 112 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/scalePolicy.ts` | 86 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/signals.ts` | 153 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/store.ts` | 217 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/systemIntelligence.ts` | 71 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/trends.ts` | 95 | Supporting module in prod closure via lib hook or backoffice stack. |
| `intelligence/types.ts` | 80 | Imported by prod app route/component on path to user response. |
| `keywords.ts` | 41 | Supporting module in prod closure via lib hook or backoffice stack. |
| `layout.ts` | 67 | Imported by prod app route/component on path to user response. |
| `layoutRules.ts` | 32 | Supporting module in prod closure via lib hook or backoffice stack. |
| `learning.ts` | 211 | Imported by prod app route/component on path to user response. |
| `learningBySurface.ts` | 41 | Supporting module in prod closure via lib hook or backoffice stack. |
| `logActivity.ts` | 74 | Imported by prod app route/component on path to user response. |
| `logging/aiActivityLogRow.ts` | 99 | Core logging/ infrastructure in prod import closure. |
| `logging/aiExecutionLog.ts` | 117 | Core logging/ infrastructure in prod import closure. |
| `logging/insertAiActivityLogCompat.ts` | 58 | Core logging/ infrastructure in prod import closure. |
| `marketSignals.ts` | 56 | Imported by prod app route/component on path to user response. |
| `memory/aiMemory.ts` | 162 | Supporting module in prod closure via lib hook or backoffice stack. |
| `memory/recordOutcome.ts` | 137 | Imported by prod app route/component on path to user response. |
| `menuToIngredients.ts` | 170 | Pillar 2/ESG core on live kitchen/admin route returning 200 without LLM. |
| `metrics.ts` | 60 | Supporting module in prod closure via lib hook or backoffice stack. |
| `normalizeCmsBlocks.ts` | 168 | Supporting module in prod closure via lib hook or backoffice stack. |
| `objectionInsights.ts` | 28 | Imported by prod app route/component on path to user response. |
| `operationsFeedback.ts` | 59 | Pillar 2/ESG core on live kitchen/admin route returning 200 without LLM. |
| `opportunities.ts` | 144 | Imported by prod app route/component on path to user response. |
| `optimize.ts` | 65 | Imported by prod app route/component on path to user response. |
| `optimizer.ts` | 111 | Imported by prod app route/component on path to user response. |
| `pageBuilderPrompts.ts` | 96 | Supporting module in prod closure via lib hook or backoffice stack. |
| `pageInsightLog.ts` | 72 | Imported by prod app route/component on path to user response. |
| `pageScore.ts` | 149 | Imported by prod app route/component on path to user response. |
| `performance.ts` | 54 | Supporting module in prod closure via lib hook or backoffice stack. |
| `policyEngine.ts` | 199 | Supporting module in prod closure via lib hook or backoffice stack. |
| `portionAllocation.ts` | 34 | Pillar 2/ESG core on live kitchen/admin route returning 200 without LLM. |
| `pricing/engine.ts` | 80 | Supporting module in prod closure via lib hook or backoffice stack. |
| `prioritization.ts` | 10 | Imported by prod app route/component on path to user response. |
| `profit/engine.ts` | 137 | Supporting module in prod closure via lib hook or backoffice stack. |
| `profit/profitState.ts` | 61 | Supporting module in prod closure via lib hook or backoffice stack. |
| `profitability.ts` | 274 | Supporting module in prod closure via lib hook or backoffice stack. |
| `prompts.ts` | 40 | Supporting module in prod closure via lib hook or backoffice stack. |
| `rateLimit.ts` | 104 | Imported by prod app route/component on path to user response. |
| `recommendationActions.ts` | 1028 | Imported by prod app route/component on path to user response. |
| `recommendations.ts` | 49 | Imported by prod app route/component on path to user response. |
| `resolveAiSuggestionFkIds.ts` | 61 | Imported by prod app route/component on path to user response. |
| `resolveRunnerCompanyForBackoffice.ts` | 39 | Imported by prod app route/component on path to user response. |
| `responseSafety.ts` | 142 | Imported by prod app route/component on path to user response. |
| `rewrite.ts` | 61 | Imported by prod app route/component on path to user response. |
| `role.ts` | 23 | Imported by prod app route/component on path to user response. |
| `run.ts` | 88 | Supporting module in prod closure via lib hook or backoffice stack. |
| `safeApply.ts` | 57 | Imported by prod app route/component on path to user response. |
| `safety/aiSafetyFilter.ts` | 156 | Core safety/ infrastructure in prod import closure. |
| `schema/errors.ts` | 52 | Core schema/ infrastructure in prod import closure. |
| `schema/events.ts` | 46 | Core schema/ infrastructure in prod import closure. |
| `schema/index.ts` | 45 | Core schema/ infrastructure in prod import closure. |
| `schema/payloads.ts` | 275 | Core schema/ infrastructure in prod import closure. |
| `schema/schemaRef.ts` | 9 | Core schema/ infrastructure in prod import closure. |
| `schema/validate.ts` | 218 | Core schema/ infrastructure in prod import closure. |
| `segmentation/engine.ts` | 88 | Supporting module in prod closure via lib hook or backoffice stack. |
| `seoAnalyzer.ts` | 159 | Supporting module in prod closure via lib hook or backoffice stack. |
| `signalEngine.ts` | 18 | Transitive dependency of live P2 route (200 without LLM). |
| `signals.ts` | 62 | Imported by prod app route/component on path to user response. |
| `simulator.ts` | 59 | Imported by prod app route/component on path to user response. |
| `siteAnalysis.ts` | 122 | Imported by prod app route/component on path to user response. |
| `siteGrowthLog.ts` | 32 | Imported by prod app route/component on path to user response. |
| `socialStrategy.ts` | 42 | Imported by prod app route/component on path to user response. |
| `strategicContext.ts` | 76 | Supporting module in prod closure via lib hook or backoffice stack. |
| `strictBlockValidator.ts` | 83 | Supporting module in prod closure via lib hook or backoffice stack. |
| `suggestMotor.ts` | 391 | Imported by prod app route/component on path to user response. |
| `systemState.ts` | 35 | Transitive dependency of live P2 route (200 without LLM). |
| `tools/abGenerateVariants.ts` | 257 | Core tools/ infrastructure in prod import closure. |
| `tools/blockBuilder.ts` | 186 | Core tools/ infrastructure in prod import closure. |
| `tools/contentMaintainPage.ts` | 257 | Core tools/ infrastructure in prod import closure. |
| `tools/imageGenerateBrandSafe.ts` | 74 | Core tools/ infrastructure in prod import closure. |
| `tools/imageImproveMetadata.ts` | 100 | Core tools/ infrastructure in prod import closure. |
| `tools/landingGenerateSections.ts` | 159 | Core tools/ infrastructure in prod import closure. |
| `tools/layoutSuggestions.ts` | 320 | Core tools/ infrastructure in prod import closure. |
| `tools/pageBuilder.ts` | 292 | Core tools/ infrastructure in prod import closure. |
| `tools/registry.ts` | 120 | Core tools/ infrastructure in prod import closure. |
| `tools/seoOptimizePage.ts` | 162 | Core tools/ infrastructure in prod import closure. |
| `tools/translateBlocks.ts` | 143 | Core tools/ infrastructure in prod import closure. |
| `tracking.ts` | 81 | Imported by prod app route/component on path to user response. |
| `transientAiJsonCache.ts` | 46 | Supporting module in prod closure via lib hook or backoffice stack. |
| `types.ts` | 93 | Imported by prod app route/component on path to user response. |
| `usage.ts` | 229 | Imported by prod app route/component on path to user response. |
| `usageOverview.ts` | 273 | Imported by prod app route/component on path to user response. |
| `validate.ts` | 62 | Supporting module in prod closure via lib hook or backoffice stack. |
| `validateComponentOutput.ts` | 82 | Supporting module in prod closure via lib hook or backoffice stack. |
| `validation/validateAiOutput.ts` | 203 | Core validation/ infrastructure in prod import closure. |
| `variantGenerator.ts` | 145 | Supporting module in prod closure via lib hook or backoffice stack. |

---

## lib/ai — REFACTOR (16 files, 3017 LOC)

| File | LOC | Justification |
|------|----:|---------------|
| `_internalProvider.ts` | 500 | Supporting module in prod closure via lib hook or backoffice stack. *(refactor: Single OpenAI provider — circuit breaker + cost ceiling.)* |
| `adsEngine.ts` | 73 | Imported by prod app route/component on path to user response. *(refactor: No proven prod UI consumer.)* |
| `anomaly.ts` | 52 | Supporting module in prod closure via lib hook or backoffice stack. *(refactor: Not wired to customer SLA alerts.)* |
| `cmsAiEngine.ts` | 278 | Imported by prod app route/component on path to user response. *(refactor: Strict block validation on every LLM response.)* |
| `conversionGenerator.ts` | 57 | Supporting module in prod closure via lib hook or backoffice stack. *(refactor: Pillar 1 — gate LLM cost.)* |
| `demandEngine.ts` | 224 | Pillar 2/ESG core on live kitchen/admin route returning 200 without LLM. *(refactor: V1 heuristic live; ML Layer 3 deferred.)* |
| `demandInsights.ts` | 114 | Pillar 2/ESG core on live kitchen/admin route returning 200 without LLM. *(refactor: Dish signals live; no CO₂ weighting yet.)* |
| `editorTextSuggest.ts` | 85 | Imported by prod app route/component on path to user response. *(refactor: Align with responseSafety scrub rules.)* |
| `experiment.ts` | 77 | Imported by prod app route/component on path to user response. *(refactor: Verify tenant isolation on experiment queries.)* |
| `funnelEngine.ts` | 111 | Imported by prod app route/component on path to user response. *(refactor: Growth funnel — confirm consumer before expand.)* |
| `pageBuilder.ts` | 172 | Imported by prod app route/component on path to user response. *(refactor: High token surface — cap blocks + validate.)* |
| `pricing.ts` | 83 | Imported by prod app route/component on path to user response. *(refactor: 10% heuristic only — not agreement-linked.)* |
| `runner.ts` | 569 | Imported by prod app route/component on path to user response. *(refactor: Add timeout, Redis rate limit, PII scrub (P2-4).)* |
| `runnerGovernance.ts` | 382 | Imported by prod app route/component on path to user response. *(refactor: Profitability gate not enterprise-hardened.)* |
| `seoEngine.ts` | 142 | Imported by prod app route/component on path to user response. *(refactor: Clarify deterministic vs LLM paths.)* |
| `wasteTracker.ts` | 98 | Pillar 2/ESG core on live kitchen/admin route returning 200 without LLM. *(refactor: ESG rollup fail-closed on produced:null — needs production qty.)* |

---

## lib/ai — INVESTIGATE (44 files, 3239 LOC)

| File | LOC | Justification |
|------|----:|---------------|
| `agents/ceoAgent.ts` | 30 | Agent swarm / boardroom still in app closure — delete importer routes in Phase B first. |
| `agents/cmoAgent.ts` | 32 | Agent swarm / boardroom still in app closure — delete importer routes in Phase B first. |
| `agents/contentHealthDaily.ts` | 140 | Agent swarm / boardroom still in app closure — delete importer routes in Phase B first. |
| `agents/cooAgent.ts` | 20 | Agent swarm / boardroom still in app closure — delete importer routes in Phase B first. |
| `agents/ctoAgent.ts` | 30 | Agent swarm / boardroom still in app closure — delete importer routes in Phase B first. |
| `agents/index.ts` | 15 | Agent swarm / boardroom still in app closure — delete importer routes in Phase B first. |
| `autonomy/automationLayer.ts` | 69 | Autonomy loop modules still in app closure — delete importer routes in Phase B first. |
| `autonomy/autonomyAttribution.ts` | 39 | Autonomy loop modules — only Pillar 1 routes import; defer per strategy. |
| `autonomy/autonomyLearning.ts` | 44 | Autonomy loop modules still in app closure — delete importer routes in Phase B first. |
| `autonomy/autonomyLog.ts` | 60 | Autonomy loop modules still in app closure — delete importer routes in Phase B first. |
| `autonomy/autonomyPolicy.ts` | 63 | Autonomy loop modules still in app closure — delete importer routes in Phase B first. |
| `autonomy/collectDecisions.ts` | 37 | Autonomy loop modules still in app closure — delete importer routes in Phase B first. |
| `autonomy/runner.ts` | 137 | Autonomy loop modules — only Pillar 1 routes import; defer per strategy. *(refactor: Imports meta-engines — decouple before prod expand.)* |
| `autonomy/types.ts` | 50 | Autonomy loop modules — only Pillar 1 routes import; defer per strategy. |
| `autonomyController.ts` | 65 | CEO / autonomy meta-dashboard (Pillar 1 defer) still in app closure — delete importer routes in Phase B first. |
| `ceo/attribution.ts` | 36 | CEO / autonomy meta-dashboard (Pillar 1 defer) — only Pillar 1 routes import; defer per strategy. |
| `ceo/automationEngine.ts` | 63 | CEO / autonomy meta-dashboard (Pillar 1 defer) still in app closure — delete importer routes in Phase B first. |
| `ceo/ceoLog.ts` | 55 | CEO / autonomy meta-dashboard (Pillar 1 defer) still in app closure — delete importer routes in Phase B first. |
| `ceo/decisionEngine.ts` | 169 | CEO / autonomy meta-dashboard (Pillar 1 defer) — only Pillar 1 routes import; defer per strategy. |
| `ceo/growthEngine.ts` | 53 | CEO / autonomy meta-dashboard (Pillar 1 defer) — only Pillar 1 routes import; defer per strategy. |
| `ceo/learning.ts` | 43 | CEO / autonomy meta-dashboard (Pillar 1 defer) still in app closure — delete importer routes in Phase B first. |
| `ceo/policyEngine.ts` | 51 | CEO / autonomy meta-dashboard (Pillar 1 defer) still in app closure — delete importer routes in Phase B first. |
| `ceo/runner.ts` | 131 | CEO / autonomy meta-dashboard (Pillar 1 defer) — only Pillar 1 routes import; defer per strategy. *(refactor: Pillar 1 defer — gate CEO autopilot behind explicit env.)* |
| `ceo/types.ts` | 66 | CEO / autonomy meta-dashboard (Pillar 1 defer) — only Pillar 1 routes import; defer per strategy. |
| `ceoExecutor.ts` | 27 | CEO / autonomy meta-dashboard (Pillar 1 defer) still in app closure — delete importer routes in Phase B first. |
| `controlTower/controlExecutor.ts` | 109 | Control-tower meta (non-core lunch) — only Pillar 1 routes import; defer per strategy. |
| `events/triggers.ts` | 22 | Meta-engine directories (engines/reality/monopoly/…) still in app closure — delete importer routes in Phase B first. |
| `experimentGenerator.ts` | 29 | Meta-engines (root stubs) still in app closure — delete importer routes in Phase B first. |
| `jobs/backoff.ts` | 12 | Meta-engine directories (engines/reality/monopoly/…) still in app closure — delete importer routes in Phase B first. |
| `jobs/claim.ts` | 49 | Meta-engine directories (engines/reality/monopoly/…) still in app closure — delete importer routes in Phase B first. |
| `jobs/runner.ts` | 227 | Meta-engine directories (engines/reality/monopoly/…) still in app closure — delete importer routes in Phase B first. |
| `orchestration.ts` | 150 | Meta-engines (root stubs) still in app closure — delete importer routes in Phase B first. |
| `pageIntent.ts` | 122 | Meta-engines (root stubs) still in app closure — delete importer routes in Phase B first. |
| `policy.ts` | 22 | Meta-engines (root stubs) still in app closure — delete importer routes in Phase B first. |
| `pre-evaluate.ts` | 42 | Meta-engines (root stubs) still in app closure — delete importer routes in Phase B first. |
| `predictor.ts` | 75 | Meta-engines (root stubs) still in app closure — delete importer routes in Phase B first. |
| `retention/engine.ts` | 62 | Meta-engine directories (engines/reality/monopoly/…) still in app closure — delete importer routes in Phase B first. |
| `revenue/analyzePerformance.ts` | 143 | Meta-engine directories (engines/reality/monopoly/…) — only Pillar 1 routes import; defer per strategy. |
| `revenue/applyRevenueActions.ts` | 79 | Meta-engine directories (engines/reality/monopoly/…) — only Pillar 1 routes import; defer per strategy. |
| `revenue/attribution.ts` | 108 | Meta-engine directories (engines/reality/monopoly/…) still in app closure — delete importer routes in Phase B first. |
| `revenue/decisionEngine.ts` | 94 | Meta-engine directories (engines/reality/monopoly/…) — only Pillar 1 routes import; defer per strategy. |
| `revenue/policy.ts` | 75 | Meta-engine directories (engines/reality/monopoly/…) — only Pillar 1 routes import; defer per strategy. |
| `strategicCeoDecision.ts` | 30 | Meta-engines (root stubs) still in app closure — delete importer routes in Phase B first. |
| `strategyEngine.ts` | 264 | Meta-engines (root stubs) still in app closure — delete importer routes in Phase B first. |

---

## lib/ai — CUT (36 files, 1053 LOC)

| File | LOC | Justification |
|------|----:|---------------|
| `attribution/aggregationEngine.ts` | 62 | No prod/lib consumer; Attribution ROI stubs. |
| `attribution/insightEngine.ts` | 19 | No prod/lib consumer; Attribution ROI stubs. |
| `attribution/roiEngine.ts` | 41 | No prod/lib consumer; Attribution ROI stubs. |
| `capital/actionGenerator.ts` | 23 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `capital/actionPriority.ts` | 14 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `capital/allocationEngine.ts` | 43 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `capital/capitalOutput.ts` | 27 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `capital/capitalState.ts` | 69 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `capital/executionEngine.ts` | 20 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `capital/executionPlan.ts` | 18 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `capital/investmentAreas.ts` | 11 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `capital/riskEngine.ts` | 22 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `capital/roiEngine.ts` | 22 | No prod/lib consumer; Capital / allocation stubs (Pillar 1). |
| `control/controlGate.ts` | 49 | No reachable importer from app/lib — safe orphan for Phase B. |
| `control/ethicsEngine.ts` | 15 | No reachable importer from app/lib — safe orphan for Phase B. |
| `control/explainEngine.ts` | 18 | No reachable importer from app/lib — safe orphan for Phase B. |
| `control/governanceEngine.ts` | 18 | No reachable importer from app/lib — safe orphan for Phase B. |
| `control/killSwitch.ts` | 11 | No reachable importer from app/lib — safe orphan for Phase B. |
| `control/normalizeControlType.ts` | 19 | No reachable importer from app/lib — safe orphan for Phase B. |
| `control/overrideEngine.ts` | 12 | No reachable importer from app/lib — safe orphan for Phase B. |
| `control/riskEngine.ts` | 13 | No reachable importer from app/lib — safe orphan for Phase B. |
| `crossSurfaceLearning.ts` | 44 | No prod/lib consumer; Meta-engines (root stubs). |
| `editorRewrite.ts` | 88 | No prod/lib consumer; Orphan — zero prod/lib importers. |
| `experienceModel.ts` | 65 | No prod/lib consumer; Meta-engines (root stubs). |
| `memoryDecay.ts` | 9 | No prod/lib consumer; Meta-engines (root stubs). |
| `outcomeEvaluator.ts` | 23 | No prod/lib consumer; Meta-engines (root stubs). |
| `predictiveModel.ts` | 42 | No prod/lib consumer; Meta-engines (root stubs). |
| `predictiveRiskEngine.ts` | 17 | No prod/lib consumer; Meta-engines (root stubs). |
| `resources/actionCost.ts` | 28 | No prod/lib consumer; Resource orchestration stubs. |
| `resources/capacityEngine.ts` | 42 | No prod/lib consumer; Resource orchestration stubs. |
| `resources/matchEngine.ts` | 19 | No prod/lib consumer; Resource orchestration stubs. |
| `resources/resourceModel.ts` | 35 | No prod/lib consumer; Resource orchestration stubs. |
| `resources/resourceOrchestrator.ts` | 26 | No prod/lib consumer; Resource orchestration stubs. |
| `resources/scheduler.ts` | 15 | No prod/lib consumer; Resource orchestration stubs. |
| `roadmapEngine.ts` | 34 | No prod/lib consumer; Meta-engines (root stubs). |
| `strategicPrioritizer.ts` | 20 | No prod/lib consumer; Meta-engines (root stubs). |

---

## app/api/ai/** — route classification

### KEEP (1)

| Route | LOC | Justification |
|-------|----:|---------------|
| `app/api/ai/usage/route.ts` | 256 | Backoffice AI overview reads usage — confirmed UI consumer. |

### INVESTIGATE (24)

| Route | LOC | Justification |
|-------|----:|---------------|
| `app/api/ai/analyze/route.ts` | 88 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/block/route.ts` | 177 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/block/score/route.ts` | 49 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/continue/route.ts` | 67 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/dashboard/route.ts` | 84 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/decision/route.ts` | 134 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/design/analyze/route.ts` | 90 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/design/generate/route.ts` | 83 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/experiments/route.ts` | 91 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/generate/route.ts` | 110 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/image/route.ts` | 67 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/inline/route.ts` | 69 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/insights/route.ts` | 81 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/layout/route.ts` | 71 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/learn/route.ts` | 69 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/optimize/route.ts` | 95 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/page/audit/route.ts` | 76 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/page/build/route.ts` | 97 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/page/route.ts` | 71 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/recommendation/apply/route.ts` | 102 | Referenced in UI (app/(backoffice)/backoffice/ai/overview/page.tsx) — confirm prod auth and 200 path. |
| `app/api/ai/recommendation/history/route.ts` | 43 | Referenced in UI (app/(backoffice)/backoffice/ai/overview/page.tsx) — confirm prod auth and 200 path. |
| `app/api/ai/rewrite/route.ts` | 60 | Public /api/ai endpoint — no confirmed fetch from app UI. |
| `app/api/ai/route.ts` | 19 | Referenced in UI (app/(backoffice)/backoffice/ai/overview/page.tsx) — confirm prod auth and 200 path. |
| `app/api/ai/track/route.ts` | 56 | Public /api/ai endpoint — no confirmed fetch from app UI. |

### CUT (5)

| Route | LOC | Justification |
|-------|----:|---------------|
| `app/api/ai/business-engine/route.ts` | 154 | Pillar 1 growth/copilot — no core lunch UI; defer per Phase 2 strategy. |
| `app/api/ai/copilot/route.ts` | 73 | Pillar 1 growth/copilot — no core lunch UI; defer per Phase 2 strategy. |
| `app/api/ai/growth/ads/route.ts` | 78 | Pillar 1 growth/copilot — no core lunch UI; defer per Phase 2 strategy. |
| `app/api/ai/growth/funnel/route.ts` | 108 | Pillar 1 growth/copilot — no core lunch UI; defer per Phase 2 strategy. |
| `app/api/ai/growth/seo/route.ts` | 107 | Pillar 1 growth/copilot — no core lunch UI; defer per Phase 2 strategy. |

---

## Appendix — AI routes outside `/api/ai/**`

| Route | Class | Notes |
|-------|-------|-------|
| `app/api/kitchen/demand-forecast/route.ts` | **KEEP** | Live 200 · KitchenView |
| `app/api/admin/demand-insights/route.ts` | **KEEP** | Live 200 · AdminInsightsClient |
| `app/api/admin/operations-tower/route.ts` | **KEEP** | Live 200 · OperationsTowerClient |
| `app/api/backoffice/ai/**` (31) | **KEEP** / **REFACTOR** | Conditional LLM · CMS UI |
| `app/api/sales/ai/route.ts` | **INVESTIGATE** | Pillar 1 defer |
| `app/api/social/ai/**` | **INVESTIGATE** | Pillar 1 defer |
| `app/api/system/ai/**` | **KEEP** | Ops diagnostics |
| `app/api/edge/ai/route.ts` | **INVESTIGATE** | Edge runtime |

---

## STOP — FASE A complete

Thomas review → FASE B atomic deletion per CUT groups.

*Generated READ-ONLY · `scripts/audit/phase2-cut-list-gen.mjs`*
