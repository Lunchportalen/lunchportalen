# Phase 2 — REFACTOR backlog (Phase 3+)

**Date:** 2026-05-26  
**Mode:** READ-ONLY backlog — ingen action i Fase B  
**Source:** [phase2-cut-list-2026-05-26.md](./phase2-cut-list-2026-05-26.md) (A.5 complete)

---

## Formål

Filer med **live prod consumer** som Thomas har bekreftet beholdes, men som trenger oppstramming før enterprise RC-promotion.

---

## ceo / autonomy / company (Thomas A.5)

| Fil | LOC | Begrunnelse |
|-----|----:|-------------|
| `autonomy/automationLayer.ts` | 69 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `autonomy/autonomyAttribution.ts` | 39 | Autonomy feedback loop — Pillar 1 defer. |
| `autonomy/autonomyLearning.ts` | 44 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `autonomy/autonomyLog.ts` | 60 | AI control page wiring. |
| `autonomy/autonomyPolicy.ts` | 63 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `autonomy/collectDecisions.ts` | 37 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `autonomy/runner.ts` | 137 | Autonomy run — decouple meta-engines. |
| `autonomy/types.ts` | 50 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `autonomyController.ts` | 65 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `ceo/attribution.ts` | 36 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `ceo/automationEngine.ts` | 63 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `ceo/ceoLog.ts` | 55 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `ceo/decisionEngine.ts` | 169 | CEO recommendations — Pillar 1 defer. |
| `ceo/growthEngine.ts` | 53 | CEO growth meta — Pillar 1 defer. |
| `ceo/learning.ts` | 43 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `ceo/policyEngine.ts` | 51 | CEO policy — Pillar 1 defer. |
| `ceo/runner.ts` | 131 | CEO run route — Pillar 1 defer. |
| `ceo/types.ts` | 66 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `ceoExecutor.ts` | 27 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `company/actionTypes.ts` | 62 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `company/anomaly.ts` | 69 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `company/automationEngine.ts` | 178 | Control-tower meta — tenant scope audit. |
| `company/decisionEngine.ts` | 135 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `company/memory.ts` | 48 | Control-tower meta — tenant scope audit. |
| `company/policyEngine.ts` | 244 | Control-tower meta — tenant scope audit. |
| `company/safety.ts` | 48 | Thomas A.5: KEEP-funksjonalitet (backoffice live) — REFACTOR-flagg Phase 3+. |
| `company/types.ts` | 106 | Control-tower panel contract. |

---

## P2 / CMS / runner (øvrig REFACTOR)

| Fil | LOC | Begrunnelse |
|-----|----:|-------------|
| `cmsAiEngine.ts` | 278 | Strict block-validering. |
| `controlTower/controlExecutor.ts` | 109 | Audit actionRegistry side effects. |
| `demandEngine.ts` | 224 | V1 live; ML Layer 3 utsatt. |
| `editorRewrite.ts` | 88 | Vurder merge med editorTextSuggest. |
| `experiment.ts` | 77 | Tenant isolation on experiment queries. |
| `intelligence/index.ts` | 98 | Meta layer — consolidate duplicate policy engines. |
| `intelligence/systemIntelligence.ts` | 71 | Design optimizer + decision route deps. |
| `pageBuilder.ts` | 172 | Cap blocks + validate. |
| `runner.ts` | 569 | Timeout, Redis rate limit, PII-scrub (P2-4). |
| `wasteTracker.ts` | 98 | ESG rollup fail-closed på produced:null. |

---

## STOP

Fase B sletter **ikke** REFACTOR-filer. Phase 3+ adresserer denne listen.

