# AI Feature Inventory — Strategic Assessment (Phase 1)

**Date:** 2026-05-26  
**Mode:** READ-ONLY (no code changes)  
**Scope:** `app/`, `lib/ai/`, `workers/`, `scripts/`, `supabase/` (AI-related)  
**Cross-ref:** [enterprise-v2 executive summary §10](../audit/enterprise-v2-2026-05-25/99-executive-summary-v2.md) (confirmed wins — do not scrap working core)

---

## Pre-flight status

| Check | Status | Note |
|-------|--------|------|
| Cleanup Z.0–Z.7 merged to `main` | **PENDING** | Work on `chore/audit-v2-deliverables`; audit PR awaiting merge |
| DC-032 deploy-i-vente | **DOCUMENTED** | 3 read-path commits on local `main` only; excluded from audit PR |
| Audit-v2 §10 read | **PASS** | Core RLS/webhook/Sentry wins are **non-AI** — this inventory does not touch them |
| READ-ONLY | **PASS** | This document only |

---

## §1 Executive summary (Phase 1)

Lunchportalen has a **large AI surface area** (~277 files under `lib/ai/`, 67 API routes under `app/api/**/ai/**`, 45+ AI-related test files) but **one live provider**: **OpenAI** via `fetch` to `api.openai.com` and the `openai` npm SDK. **No** Anthropic, Gemini, Cohere, Bedrock, pgvector, Pinecone, or Weaviate usage was found in application code.

AI usage splits into four buckets:

1. **Production-capable generative (Type A)** — Backoffice CMS/editor (`runAi` runner), gated by `isAIEnabled()` → **503 FEATURE_DISABLED** without `AI_API_KEY` / `OPENAI_API_KEY`. Superadmin-heavy; suggestion-only patches with safety filters.
2. **Deterministic “AI-branded” analytics (Type C)** — Demand forecast V1, waste rollup, portion allocation — **no LLM**; statistical/heuristic. Used on admin/kitchen paths; **ESG-relevant** (waste, forecast).
3. **Aspirational meta-engines (Type D)** — CEO/control-tower/autonomy/capital/revenue subsystems under `lib/ai/` (~200+ files flagged in `scripts/audit/lib-ai-cut-list.mjs`). Partially wired to backoffice UI/API but not core lunch ordering.
4. **Internal tooling (Type A, non-prod)** — `scripts/codex-*.mjs` call OpenAI Responses API for repo diffs; separate from **compliance AI-batch docs** (F-LYV §3.2 — document generation, not runtime).

**Embedding (Type B):** **None** in repo. No vector store, no embedding API calls.

**Cost:** No OpenAI dashboard access in this session. With AI disabled in prod (typical RC posture), marginal cost ≈ **$0/mo**. If enabled for superadmin CMS only, estimate **$5–40/mo** at low volume (`gpt-4o-mini` default). Sales/social paths raise PII and cost risk if turned on.

**Strategic headline:** Treat **`lib/ai/runner.ts` + backoffice routes + demand/waste engines** as the real inventory; treat the rest as **archive candidates** pending Phase 2–3 (KEEP/HARDEN/REBUILD/ARCHIVE/DELETE).

---

## §2 Phase 1 — Feature inventory table

| ID | Feature | Type | Primary file(s) | Prod? | Model(s) | Cost/mo (est.) | PII-risk | Customer-impact | Audit-ref |
|----|---------|------|-----------------|-------|----------|----------------|----------|-----------------|-----------|
| **AI-001** | Core OpenAI provider + `runAi` runner | A | `lib/ai/_internalProvider.ts`, `lib/ai/runner.ts` | **Conditional** — only if env key set | `gpt-4o-mini` default (`AI_MODEL` / `bootstrap`); chat + JSON mode | $0 if disabled; $5–30 if CMS active | M — prompts vary by caller | L — superadmin/backoffice only | Rotate checklist Tier 3 `OPENAI_API_KEY`; `scripts/ci/ai-governance-check.mjs` |
| **AI-002** | Backoffice tool registry (suggest route) | A | `lib/ai/tools/registry.ts`, `app/api/backoffice/ai/suggest/route.ts` | Conditional | Via runner | Included in AI-001 | M — page blocks, SEO text | L — superadmin CMS | Fase F skip-auth N/A (backoffice gated) |
| **AI-003** | Editor: text / CTA improve | A | `lib/ai/editorTextSuggest.ts`, `app/api/backoffice/ai/text-improve`, `cta-improve` | Conditional | `AI_RUNNER_TOOL.EDITOR_*` | Included | **H** — user-edited copy may contain names/emails | L | `tests/security/editorAiPermissionGuarantees.test.ts` |
| **AI-004** | Editor: block / page / layout builder | A | `lib/ai/pageBuilder.ts`, `layout.ts`, `generator.ts`, routes `block-builder`, `page-builder`, `layout-suggestions` | Conditional | Structured JSON (`gpt-4o-mini`) | Included | M — CMS structure, no order PII | L | `tests/api/backofficeAiPageBuilderRoute.test.ts` |
| **AI-005** | CMS menu structured JSON | A | `lib/ai/cmsAiEngine.ts`, `cmsAiActions.ts`, `app/api/backoffice/ai/cms-menu` | Conditional | `CMS_STRUCTURED_JSON` tool | Included | L — menu titles/allergens | L — editor-only, no auto-apply | `tests/ai/cmsAiEngine.heuristic.test.ts` (heuristic path without LLM) |
| **AI-006** | Image generation (brand-safe / DALL-E) | A | `lib/ai/tools/imageGenerateBrandSafe.ts`, `app/api/backoffice/ai/image-generator` | Conditional | OpenAI Images API | +$5–20 if used (1024 images rare) | L — prompts are creative briefs | L | Profitability cap in `lib/ai/profitability.ts` |
| **AI-007** | Legacy `runAI()` + `ai_config` DB prompts | A | `lib/ai/run.ts`, `lib/ai/prompts.ts`, `lib/ai/getClient.ts` | Conditional | From `ai_config` row | Included | **H** on sales paths — see AI-009 | M — sales/market copy | `lib/ai/validate.ts` fail-closed on registry |
| **AI-008** | Public `/api/ai/*` surface (copilot, block, page, growth, etc.) | A | `app/api/ai/**` (20+ routes) | Partial — auth varies by route | Runner / runAI | Low unless exposed | M–H depending on route | M — marketing/growth experiments | `tests/security/ai-routes-auth.test.ts` |
| **AI-009** | Sales / outbound / market LLM helpers | A | `lib/sales/outreach.ts`, `lib/market/message.ts`, `lib/acquire/strategy.ts`, `app/api/sales/ai` | **Unclear** — code exists | `OPENAI_DEFAULT_MODEL` / `AI_MODEL` | Spike risk if cron hits | **H** — lead emails, company names | M — B2B sales, not lunch employee | Separate from core order RPC (§10 win #10) |
| **AI-010** | Social / conversion post generator | A | `lib/ai/conversionGenerator.ts`, `lib/social/unifiedGenerator.ts`, `app/api/social/ai/**` | Unclear | Chat completion temp 0.7 | Low–M | M — product/marketing text | L | |
| **AI-011** | CEO / control-tower / autopilot meta-engines | A+D | `lib/ai/ceo/*`, `lib/ai/controlTower/*`, `lib/autopilot/engine.ts`, `app/api/backoffice/ceo/*`, `app/api/control-tower` | **Mostly internal** | Mix runAI + heuristics | Low | L — aggregated metrics | L — operator dashboards | `scripts/audit/lib-ai-cut-list.mjs` flags many dirs |
| **AI-012** | Demand forecast V1 (kitchen/admin) | C | `lib/ai/demandEngine.ts`, `app/api/kitchen/demand-forecast`, `app/api/admin/operations-tower` | **Yes** — no API key required | N/A (moving avg + trend) | $0 | L — aggregated order counts | **H** — kitchen planning | Explicitly non-ML in file header; ESG driver candidate |
| **AI-013** | Waste / leftover metrics | C | `lib/ai/wasteTracker.ts` | **Yes** (when production data present) | N/A | $0 | L — aggregated volumes | **H** — ESG reporting | Fail-closed without production registration |
| **AI-014** | Portion allocation + ops feedback | C | `lib/ai/portionAllocation.ts`, `lib/ai/operationsFeedback.ts` | Yes (admin ops) | N/A | $0 | L | M — kitchen ops | Used with AI-012 in operations-tower |
| **AI-015** | Pricing suggestion (rule-based) | C | `lib/ai/pricing.ts` (suggestPricing) | Code present | N/A — 10% heuristic | $0 | L | L — advisory only | Not LLM despite `lib/ai/` path |
| **AI-016** | Predictive / experience models | C+D | `lib/ai/predictiveModel.ts`, `experienceModel.ts`, `predictiveRiskEngine.ts` | **Orphan-risk** | Heuristic / unused ML | $0 | L | L | Few external importers |
| **AI-017** | Dev scripts: codex audit/design | A | `scripts/codex-audit-autofix.mjs`, `scripts/codex-design-system.mjs` | **No** — local dev only | `OPENAI_MODEL` default `gpt-5` in script | Ad-hoc dev spend | M — sends repo snippets | None | Not deployed |
| **AI-018** | Audit automation (lib-ai scripts) | D | `scripts/audit/lib-ai-*.mjs`, `lib-ai-keep-closure.json` | No | N/A | $0 | L | None | Prior Fase A cut-list analysis |
| **AI-019** | Compliance doc AI-batch (2026-04-18) | D (docs) | 62/73 root MD files | N/A — **not runtime** | Unknown external batch | Unknown (one-time) | **H** if real company data in prompts | **H** — DD narrative | §3.2 F-LYV; moved to `docs/internal/drafts/` in cleanup plan |
| **AI-020** | Bulk `lib/ai` aspirational modules | D | ~200 paths in `lib-ai-cut-list.mjs` ARCHIVE_DIRS | No / partial UI | Mostly unwired | $0 | L | L | `02-monorepo-anatomi.md` — large lib/ai footprint |

**Type legend:** A = Generative LLM · B = Embedding · C = Predictive/statistical · D = Orphan/dead/experimental

**Prod? legend:** *Conditional* = requires `AI_API_KEY` or `OPENAI_API_KEY`; routes return **503 FEATURE_DISABLED** when off (`isAIEnabled()`).

---

## §2.1 Provider call-site summary

| Provider | Package / transport | Call sites (representative) | Prompt pattern |
|----------|---------------------|----------------------------|----------------|
| **OpenAI Chat** | `fetch('https://api.openai.com/v1/chat/completions')` + `openai` SDK | `_internalProvider.ts`, `run.ts`, `getClient.ts` | Registry + hardcoded system prompts in tools; JSON response_format for CMS |
| **OpenAI Images** | `fetch('.../images/generations')` | `_internalProvider.ts`, `image.ts`, image-generator route | Hardcoded size/style in route body |
| **OpenAI Responses** | `fetch('https://api.openai.com/v1/responses')` | `scripts/codex-*.mjs` only | Unified diff generation — dev tooling |

**Not found:** Anthropic, Vercel AI SDK, Gemini, Cohere, HuggingFace, Bedrock, pgvector, Pinecone, Weaviate, Chroma.

---

## §2.2 Configuration surface

### Environment variables (canonical)

| Variable | Purpose | Found in |
|----------|---------|----------|
| `AI_API_KEY` | Primary API key | `_internalProvider.ts` |
| `OPENAI_API_KEY` | Backward-compat fallback | Same |
| `AI_PROVIDER` | Expected `openai` | Same |
| `AI_MODEL` | Model id; `bootstrap` → `gpt-4o-mini` | Same |
| `OPENAI_DEFAULT_MODEL` | Sales/social override | `lib/sales/aiResponse.ts`, `sequenceMessage.ts` |
| `OPENAI_MODEL` | Dev scripts only | `scripts/codex-*.mjs` |

**Not in tracked `.env.example`** (grep empty) — keys documented in onboarding §12, rotate checklist, `EDITOR_AI_CAPABILITY_MODEL.md`.

### Per-environment behavior (inferred)

| Env | Expected |
|-----|----------|
| **Prod** | AI likely **disabled** unless key deliberately set; rotate checklist lists key in prod-backup snapshot only |
| **Staging** | May enable for CMS experiments |
| **Local dev** | `.env.local`; capability route shows hint when missing |

### Rate limits

| Layer | Mechanism |
|-------|-----------|
| Tool registry | Per-tool windows (e.g. 30–60 req/hour) in `AI_TOOLS` |
| Routes | `checkAiRateLimit()` — **in-memory** per identity+scope (`lib/ai/rateLimit.ts`) |
| Runner | `runnerGovernance.ts`, profitability gate, company eligibility (`assertCompanyAiEligibleForRun`) |

**Gap:** In-memory rate limits do not survive serverless cold starts / multi-instance — enterprise hardening candidate (Phase 2).

### Timeouts / retries / fallback

| Mechanism | Status |
|-----------|--------|
| Timeout on OpenAI fetch | **Not explicit** in `_internalProvider.ts` (relies on platform default) |
| Retry with backoff | **Partial** — job runner has backoff (`lib/ai/jobs/backoff.ts`); provider calls generally **fail closed** |
| Fallback model | `FALLBACK_CHAT_MODEL_ID` = `gpt-4o-mini`; profitability may downgrade |
| Heuristic fallback | `cmsAiEngine` heuristic improve path **without** LLM when disabled |
| Sentry on AI errors | `logEvent` / `AiRunnerError` paths; not uniform on all routes |

### Database

| Table | Role |
|-------|------|
| `ai_activity_log` | Audit trail for runs (migrations from 202603+) |
| `ai_config` | Model + `prompt_registry` for legacy `runAI()` |

---

## §2.3 PII & data-flow notes (by feature class)

| Data sent to OpenAI | Features | Risk |
|--------------------|----------|------|
| CMS block text, SEO fields | AI-002–006 | Medium — may include company marketing copy |
| User-typed editor strings | AI-003 | **High** if users paste email/phone |
| Sales lead / outreach context | AI-009 | **High** — B2B contact data |
| Order counts / aggregates only | AI-012–014 | **Low** — stays in Postgres, not sent to OpenAI |
| Repo file excerpts | AI-017 | Medium — dev only |

**Audit alignment:** §10 win #3 — Sentry PII scrub applies to errors, **not** to outbound OpenAI payloads. No dedicated `replaceUserData()` scrubber found before provider calls.

---

## §3 Cost baseline (Phase 1.4)

### Actual usage data

**Not available** in this session (no OpenAI/Anthropic dashboard access). Owner can export last 3 months for Phase 2 refinement.

### Estimation model (assumptions explicit)

| Assumption | Value |
|------------|-------|
| Default chat model | `gpt-4o-mini` (~$0.15 / 1M input, ~$0.60 / 1M output — order of magnitude) |
| Prod AI enabled | **Unknown** — assume **off** for RC baseline |
| Active users if enabled | 1–3 superadmin CMS operators |
| Requests/month if enabled | 50–500 editor actions |
| Avg tokens/request | ~2k input + 800 output |
| Images/month | 0–20 |

| Scenario | Est. USD/mo |
|----------|-------------|
| **A: AI disabled (default RC)** | **$0** |
| **B: CMS only, low traffic** | **$5–40** |
| **C: Sales/social cron enabled** | **$50–300+** (high variance) |
| **D: Dev codex scripts ad hoc** | **$0–50** (local) |

**DB alternative for actuals:** Query `ai_activity_log` metadata for token estimates when prod access available (`lib/ai/usage.ts` has pricing helpers).

---

## §4 Audit cross-reference (Phase 1.5)

| Audit item | Relation to AI inventory |
|------------|-------------------------|
| **§3.2 AI-batch compliance (62/73 MD)** | **Separate concern** — one-time **document generation**, not `lib/ai` runtime. Same *brand* of “AI” but different pipeline. F-LYV remediation = STRIP/downgrade claims, move drafts internal. |
| **§10 confirmed wins** | RLS, webhooks, order RPC, Sentry — **do not conflate** with AI-011/019 aspirational docs/code. |
| **Rotate checklist Tier 3 — `OPENAI_API_KEY`** | Found in `.env.local.prod-backup` snapshot only. Used by AI-001–010 when enabled; rotation recommended before Z.2 spike delete. |
| **`scripts/audit/lib-ai-cut-list.mjs`** | Prior staff analysis: ~200 `lib/ai` subpaths flagged ARCHIVE_DIRS — supports AI-020 orphan classification. |
| **`scripts/ci/ai-governance-check.mjs`** | 61 route files — disabled gate must not return `ok:true` in catch. |

---

## §5 Phase 1 conclusions

1. **Single provider (OpenAI)** — strategy simplification possible; no embedding layer to migrate.
2. **Real prod value today is likely Type C** (demand/waste/ops) **not Type A** (LLM), unless CMS AI is deliberately enabled.
3. **`lib/ai/` is ~70% aspirational surface area** by file count — Phase 3 should ARCHIVE/DELETE aggressively after import-graph proof.
4. **PII + cost gates exist but are not enterprise-complete** (in-memory rate limit, no prompt scrub, no provider timeout).
5. **Compliance AI-batch ≠ product AI** — keep narrative separate in DD and ESG follow-up.

---

## STOP — Phase 1 complete

**Deliverable:** This document §1–§5 (Phase 1 scope).

**Next:** Reply **`GO Phase 2`** for value + risk matrix (§2 extended columns, maturity scoring).

**Not in scope until Phase 2–3:** K/H/R/A/D recommendations, DC tickets, ESG-engine cross-link implementation.

---

*Generated READ-ONLY 2026-05-26 · Branch baseline: `chore/audit-v2-deliverables`*
