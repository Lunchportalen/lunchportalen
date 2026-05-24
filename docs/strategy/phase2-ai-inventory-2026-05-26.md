# Phase 2 — AI Inventory (repo crawl)

**Date:** 2026-05-26  
**Mode:** READ-ONLY · full crawl `lib/`, `app/`  
**Cross-ref:** [Phase 1 AI inventory](./ai-feature-inventory-2026-05-26.md) (AI-001–AI-020) · [ESG Phase 1](./esg-engine-design-2026-05-26.md)

---

## A.1 Crawl summary

### Grep: provider / LLM keywords

| Pattern | `lib/` hits | `app/` hits |
|---------|------------:|------------:|
| `openai\|anthropic\|claude\|gpt-\|llm\|embedding` | **56** | **18** |
| `editor-ai\|editorAi\|/api/ai\|lib/ai` | **~180** | **~55** |

**Provider reality (unchanged from Phase 1):** OpenAI only (`lib/ai/_internalProvider.ts`, `lib/ai/run.ts`, `lib/ai/getClient.ts`). **No embeddings**, no Anthropic/Gemini/Bedrock in app code.

### Scale

| Area | Count |
|------|------:|
| `lib/ai/**/*.ts` | **279** files |
| `app/api/**/ai/**/route.ts` | **67** |
| `app/api/backoffice/ai/**/route.ts` | **31** |
| AI-related tests (`tests/**/*ai*`) | **45+** |

### PublishedModels in Views

**0 files** — Umbraco marketing views use `IPublishedElement` + `Model.Value<>()` (see marathon audit 2026-05-25). Not an AI finding but confirms no MB coupling in CMS layer.

---

## A.2 Classification matrix (production-relevant)

**Legend**

| Prod | Meaning |
|------|---------|
| **Live** | Runs without `AI_API_KEY`; used in prod paths today |
| **Conditional** | Requires `isAIEnabled()` → 503 `FEATURE_DISABLED` without key |
| **Dev only** | Scripts / local tooling |
| **Dead / orphan** | Code exists; no stable importers or UI wiring |

| ID | Feature / module | Primary paths | Prod | Use case | Cost | Latency |
|----|------------------|---------------|------|----------|------|---------|
| **P2-A01** | Demand forecast V1 | `lib/ai/demandEngine.ts`, `lib/ai/demandData.ts`, `app/api/kitchen/demand-forecast`, `app/api/admin/demand-insights`, `app/api/admin/operations-tower` | **Live** | Kitchen + company_admin ops | $0 (no LLM) | Low (DB agg) |
| **P2-A02** | Waste rollup | `lib/ai/wasteTracker.ts`, wired in `demand-insights` | **Live** (partial) | ESG / admin insight | $0 | Low |
| **P2-A03** | Portion / ops feedback | `lib/ai/portionAllocation.ts`, `lib/ai/operationsFeedback.ts` | **Live** (admin ops) | Kitchen planning | $0 | Low |
| **P2-A04** | Demand dish signals | `lib/ai/demandInsights.ts` | **Live** | Menu mix hints from `day_choices` | $0 | Low |
| **P2-A05** | Core LLM runner | `lib/ai/runner.ts`, `_internalProvider.ts` | **Conditional** | Backoffice CMS | Per-request ($5–40/mo low vol) | Med (1–8s) |
| **P2-A06** | Editor text / CTA | `lib/ai/editorTextSuggest.ts`, `app/api/backoffice/ai/text-improve`, `cta-improve` | **Conditional** | Admin CMS | Per-request | Med |
| **P2-A07** | Page / block / layout builder | `lib/ai/pageBuilder.ts`, `layout.ts`, `block-builder`, `page-builder`, `layout-suggestions` | **Conditional** | Admin CMS | Per-request | Med–high |
| **P2-A08** | CMS menu structured JSON | `lib/ai/cmsAiEngine.ts`, `cms-menu` route | **Conditional** | Admin menu assist | Per-request | Med |
| **P2-A09** | Image generation | `lib/ai/tools/imageGenerateBrandSafe.ts`, `image-generator` | **Conditional** | Admin creative | Per-image | High |
| **P2-A10** | Public `/api/ai/*` (20+ routes) | `app/api/ai/**` | **Partial** — auth varies | Growth / copilot experiments | Spike if exposed | Med |
| **P2-A11** | Sales / outreach LLM | `lib/sales/outreach.ts`, `lib/sales/aiResponse.ts`, `app/api/sales/ai` | **Unclear** | B2B lead-gen | High if cron | Med |
| **P2-A12** | Social / conversion copy | `lib/ai/conversionGenerator.ts`, `lib/social/unifiedGenerator.ts`, `app/api/social/ai/**` | **Unclear** | Marketing | Med | Med |
| **P2-A13** | Pricing heuristic | `lib/ai/pricing.ts` (`suggestPricing` — 10% rule) | **Code** | Advisory pricing | $0 | Instant |
| **P2-A14** | CRO / SEO analyzers | `lib/ai/croAnalyzer.ts`, `seoAnalyzer.ts`, `lib/cro/*` | **Partial** | Conversion scoring (mostly deterministic) | $0–low | Low |
| **P2-A15** | CEO / control-tower / autopilot | `lib/ai/ceo/*`, `lib/autopilot/*`, `app/api/control-tower` | **Mostly internal** | Operator dashboards | Low | Med |
| **P2-A16** | Predictive / ML stubs | `lib/ml/lstmModel.ts`, `lib/ai/predictiveModel.ts`, `predictiveRiskEngine.ts` | **Orphan-risk** | Future forecast | $0 | — |
| **P2-A17** | Anomaly / monitoring | `lib/ai/anomaly.ts`, `lib/monitoring/run.ts` | **Partial** | Ops alerts | $0 | Batch |
| **P2-A18** | Dev codex scripts | `scripts/codex-*.mjs` | **Dev only** | Repo tooling | Ad hoc | — |
| **P2-A19** | Bulk `lib/ai` meta-engines | ~200 paths in `scripts/audit/lib-ai-cut-list.mjs` | **Dead / aspirational** | None in core lunch flow | $0 | — |

### Cost-profile detail

| Profile | Modules | Notes |
|---------|---------|-------|
| **Per-request LLM** | P2-A05–A09, A10–A12 | Gated by `isAIEnabled()`; profitability + governance in `runnerGovernance.ts` |
| **Batch / cron** | Sales sequences, social calendar (if enabled) | Highest spike risk |
| **Zero marginal** | P2-A01–A04, A13–A14, A17 | Postgres + deterministic math only |

### Latency sensitivity

| Tier | Routes / UX | Requirement |
|------|-------------|-------------|
| **Hard real-time** | Kitchen view forecast fetch | &lt; 2s p95 — currently DB-bound, OK |
| **Interactive editor** | Backoffice AI panels | 3–10s acceptable with loading state |
| **Batch / dashboard** | demand-insights, operations-tower | 5–30s OK |

---

## A.3 Pillar mapping (strategic frame)

### Pillar 1 — Vekst (growth / revenue)

| Use case | Status | Evidence | Gap |
|----------|--------|----------|-----|
| **Lead scoring** | **Delvis** | `lib/leads/createLead.ts`, `lib/ai/adaptiveScoring.ts`, `lib/sales/selection.ts` | No prod-proven model; mostly heuristics |
| **Churn prediction** | **Delvis** | `lib/ai/profit/profitState.ts` (churn proxy in metrics) | No tenant-level churn model or alerts |
| **Sales chat** | **Delvis** | `lib/sales/aiResponse.ts`, `app/api/sales/ai` | Not tied to core order funnel |
| **Conversion AI** | **Delvis** | `lib/ai/conversionGenerator.ts`, `lib/cro/*`, `app/api/ai/growth/*` | Deterministic CRO scoring + optional LLM |
| **Pricing intelligence** | **Delvis** | `lib/ai/pricing.ts` (rule), `lib/pricing/strategy.ts`, admin pricing views | No LLM; no agreement-linked dynamic pricing |

### Pillar 2 — Hjelpemiddel (operations / product)

| Use case | Status | Evidence | Gap |
|----------|--------|----------|-----|
| **Demand forecast** | **Implementert** | `forecastDemandV1` — kitchen + admin routes live | ML Layer 3 not started; no multi-location ensemble |
| **Menu suggestions** | **Delvis** | `demandInsights` dish signals from `day_choices`; `cmsAiEngine` for Sanity menu JSON | No employee-facing suggestions; no CO₂-aware menu |
| **Support AI** | **Ikke startet** | No `/support` or ticket LLM route | — |
| **Anomaly detection** | **Delvis** | `lib/ai/anomaly.ts`, health/incident paths | Not wired to customer-facing SLA |
| **Editor AI** | **Implementert** (conditional) | 31 backoffice AI routes + ContentWorkspace AI cluster | Disabled without API key; PII scrub gap |

### Cross-pillar (ESG-relevant Type C — see synergy doc)

| Module | Pillar | ESG link |
|--------|--------|----------|
| P2-A01 Demand | 2 | Reduces overproduction → waste / CO₂e avoided |
| P2-A02 Waste | 2 | Direct ESG KPI input (needs production qty) |
| P2-A04 Dish signals | 2 | Menu mix → emission factor weighting |

---

## A.4 Delta vs Phase 1 (AI-001–AI-020)

| Phase 1 ID | Phase 2 status | Change |
|------------|----------------|--------|
| AI-012 Demand | **Confirmed Live** | Kitchen UI calls `/api/kitchen/demand-forecast` (`KitchenView.tsx`) |
| AI-013 Waste | **Confirmed partial Live** | `produced: null` in demand-insights — rollup always fail-closed on full waste % |
| AI-001–006 Editor | **Unchanged Conditional** | Single provider, no timeout hardening |
| AI-020 Orphan bulk | **Still valid** | 279 files in `lib/ai/` — cut-list remains Phase 3 action |

---

## A.5 Phase 2 priorities (AI-only)

| Priority | Action | Effort | Rationale |
|----------|--------|--------|-----------|
| **P2-1** | Harden **P2-A01–A04** (demand + waste data path) | 2–3 uker | Only zero-cost prod value; feeds ESG |
| **P2-2** | **ARCHIVE** aspirational `lib/ai` dirs per cut-list | 1–2 uker | Reduce DD noise |
| **P2-3** | Gate sales/social LLM (P2-A11–A12) behind explicit env + tenant | 1 uke | PII + cost |
| **P2-4** | Editor AI hardening (timeout, rate limit Redis, prompt scrub) | 2 uker | Enterprise CMS |
| **P2-5** | Pillar 1 lead/churn — **do not expand LLM** until ESG v1 ships | — | Focus |

---

## STOP — Phase 2 AI inventory complete

Next: [phase2-esg-data-gap-2026-05-26.md](./phase2-esg-data-gap-2026-05-26.md) · [phase2-synergi-roadmap-2026-05-26.md](./phase2-synergi-roadmap-2026-05-26.md)

*Generated READ-ONLY 2026-05-26 · Branch: `main`*
