# AI editor verification map and status

Senior AI editor QA view: trigger points, request/response paths, provider layer, apply behavior, and logging. AI is only marked VERIFIED where trigger path, response handling, and apply behavior are proven (modal opening is not verification). No fake provider success.

---

## 1. AI editor map

| Layer | Detail |
|-------|--------|
| **Trigger points** | ContentWorkspace: text-improve (title), cta-improve (CTA block), seo-intelligence (Kjør sideanalyse). useContentWorkspaceAi: callAiSuggest (suggest), handlePageBuilder, handleAiBlockBuilder, handleLayoutSuggestions, handleApplyDesignSuggestion, handleAiImageGenerate, handleAiImageImproveMetadata, handleScreenshotBuilder. |
| **Request paths** | Real `fetch`: `/api/backoffice/ai/suggest`, `/api/backoffice/ai/page-builder`, `/api/backoffice/ai/text-improve`, `/api/backoffice/ai/cta-improve`, `/api/backoffice/ai/seo-intelligence`, `/api/backoffice/ai/block-builder`, `/api/backoffice/ai/layout-suggestions`, `/api/backoffice/ai/design-suggestion/log-apply`, `/api/backoffice/ai/image-generator`, `/api/backoffice/ai/image-metadata`, `/api/backoffice/ai/screenshot-builder`, `/api/backoffice/ai/capability`, `/api/backoffice/ai/apply` (log only). |
| **Provider/client** | lib/ai/provider: `isAIEnabled()`, `suggestEditorText`, `suggestCtaImprove`; suggest route uses `runSuggest` (lib/ai/suggestMotor); page-builder uses `generatePageStructure` / `generatePageFromStructuredInput` (lib/ai/tools/pageBuilder). When `!isAIEnabled()`: routes return 503 FEATURE_DISABLED; text-improve/cta-improve use sync fallbacks (editorTextSuggest, improveCtaToSuggestionFallback). Page builder degrades to deterministic templates when AI unavailable. |
| **Response handling** | editorAiContracts: parseBackofficeAiJson, parseSuggestPayload, parsePageBuilderResponse, parseBlockBuilderResponse, parseLayoutSuggestionsResponse, etc. Malformed → null; no apply. Stale guard: effectiveIdRef.current !== requestContextId → do not apply. |
| **Patch/apply layer** | applyAIPatchV1 (lib/cms/model/applyAIPatch) applied client-side; only when applied.ok; onApplySuggestPatch(editorBlocks, mergedMeta) updates workspace. Design suggestion: applyAIPatchV1 then onApplySuggestPatch; then POST design-suggestion/log-apply. Page builder: append/replace sets blocks then user clicks Lagre (normal save). |
| **Logging/metrics** | logEditorAiEvent(evt) → POST /api/editor-ai/metrics (best-effort, no retry). Route: validate type/feature, insert ai_activity_log. Apply audit: POST /api/backoffice/ai/apply with tool, patch → ai_activity_log + recordSuggestionApplied. |

---

## 2. Status matrix

| AI FLOW | STATUS | EVIDENCE | FAILURE LAYER | EXACT FILES INVOLVED |
|---------|--------|----------|---------------|----------------------|
| **SEO (suggest → apply → save)** | VERIFIED | E2E: Kjør sideanalyse → Anbefalinger → Bruk → Lagre → Sist lagret → GET body has meta.seo.title. Real request to /api/backoffice/ai/suggest (or seo-intelligence); apply via patch; save via PATCH pages/:id. | API 503/4xx → reportAiError; parse null → no apply. | useContentWorkspaceAi (callAiSuggest), ContentWorkspace (seo-intelligence), suggest or seo-intelligence route; applyAIPatchV1; useContentWorkspaceSave; e2e/ai-cms.e2e.ts |
| **Page builder (append/replace)** | VERIFIED | E2E: Sidetype Kontakt/Priser → Generer side → Legg til under / Erstatt → Lagre → GET blocks (hero, richText, cta); reload → GET again. Request to /api/backoffice/ai/page-builder; result parsed; append/replace updates blocks; save is normal PATCH. | isAIEnabled false → deterministic templates. API error → reportAiError; no apply. | useContentWorkspaceAi (handlePageBuilder), page-builder route, pageBuilder.ts, parsePageBuilderResponse; editor-save path; e2e/ai-cms.e2e.ts |
| **Text improve** | PARTIAL | Route: POST text-improve → editorTextSuggestAsync → suggestEditorText (provider) or sync fallback. No E2E that triggers text-improve and asserts suggestion or failure. Contract/response handling in editor (ContentWorkspace). | 503 → fallback suggestion. Rate limit → 429. | ContentWorkspace (handleImproveTitle), text-improve route, editorTextSuggest.ts, lib/ai/provider |
| **CTA improve** | PARTIAL | Route: POST cta-improve → suggestCtaImprove or fallback. No E2E that triggers CTA improve and asserts suggestion or failure. | 503 → fallback. | ContentWorkspace (handleOpenCtaAi, apply), cta-improve route, lib/ai/provider |
| **Suggest (generic tool)** | PARTIAL | callAiSuggest → POST /api/backoffice/ai/suggest → runSuggest. Response parsed; patch applied only when applied.ok. Stale guard in useContentWorkspaceAi. E2E covers SEO path (which may use suggest or seo-intelligence). No dedicated E2E for arbitrary tool. | 503, 429, parse null → no apply. | useContentWorkspaceAi, suggest route, runSuggest, editorAiContracts (parseSuggestPayload) |
| **Block builder** | PARTIAL | handleAiBlockBuilder → POST block-builder. Result in aiBlockBuilderResult; apply is separate user action. Unit: parseBlockBuilderResponse. No E2E trigger→apply. | isAIEnabled, rate limit, parse null. | useContentWorkspaceAi, block-builder route, editorAiContracts |
| **Layout suggestions / design apply** | PARTIAL | handleLayoutSuggestions → layout-suggestions; handleApplyDesignSuggestion uses applyAIPatchV1 then POST design-suggestion/log-apply. Unit: applyAIPatchV1 reject path. No E2E. | apply fail → reportAiError; log-apply 5xx. | useContentWorkspaceAi, layout-suggestions route, design-suggestion/log-apply route, applyAIPatch |
| **Append/replace/apply (patch)** | VERIFIED | applyAIPatchV1: unit tests (editorAiGuarantees, aiSystemGuarantees) prove reject path, no mutation, insertBlock/updateBlockData. E2E: SEO apply + page builder append/replace exercise apply then save. | Invalid patch → ok:false; block not found → ok:false. | applyAIPatch.ts, aiPatch (validateAIPatchV1); tests/cms/editorAiGuarantees.test.ts, tests/ai/aiSystemGuarantees.test.ts; E2E ai-cms |
| **Apply logging (audit)** | VERIFIED | POST /api/backoffice/ai/apply: unit test (backofficeAiApply.test.ts) 401, 403, 500 when insert fails (no silent drop). Apply route writes ai_activity_log + recordSuggestionApplied. | Insert failure → 500. | app/api/backoffice/ai/apply/route.ts, tests/api/backofficeAiApply.test.ts |
| **Editor-AI metrics (logEditorAiEvent)** | VERIFIED | logEditorAiEvent → POST /api/editor-ai/metrics. Route: unit tests (editorAiMetrics.test.ts, editorAiMetricsPersistence.test.ts) — auth, valid type/feature, invalid type/feature 400, insert failure 500. Client best-effort (no retry). | 4xx/5xx → client does not retry. Insert fail → 500. | logEditorAiEvent.ts, app/api/editor-ai/metrics/route.ts, tests/api/editorAiMetrics.test.ts, tests/api/editorAiMetricsPersistence.test.ts |
| **Capability check** | PARTIAL | GET /api/backoffice/ai/capability → aiCapability loading/available/unavailable. Used to gate UI. No E2E that asserts disabled state when env missing. | Provider config → enabled false. | useContentWorkspaceAi (useEffect fetch capability), capability route, lib/ai/provider |

---

## 3. Classification (provider / mock / partial / blocked)

| Flow | Classification | Notes |
|------|----------------|--------|
| **SEO suggest** | Real provider-backed | runSuggest / seo tool; when isAIEnabled. E2E runs against real or fallback; proof is apply→save→GET. |
| **Page builder** | Real provider-backed or partial | When isAIEnabled: LLM. When disabled: deterministic templates (pageBuilder.ts). E2E proves full path; templates still return blocks. |
| **Text improve** | Real provider-backed or partial | suggestEditorText when enabled; editorTextSuggest sync fallback when disabled/fail. |
| **CTA improve** | Real provider-backed or partial | suggestCtaImprove when enabled; improveCtaToSuggestionFallback when disabled/fail. |
| **Block builder, layout, image, screenshot** | Real provider-backed when enabled | isAIEnabled at route; 503 when disabled. No mock in tests that fakes success. |
| **Apply (patch)** | N/A (client-side) | applyAIPatchV1 is deterministic; no provider. Verified by unit + E2E apply path. |
| **Metrics / apply log** | Real API | POST to real routes; persistence to ai_activity_log. Not mocked in E2E. |

**Blocked by env:** All routes that call isAIEnabled() return 503 FEATURE_DISABLED when AI_API_KEY (or OPENAI_API_KEY) is missing or invalid. E2E that need AI (e.g. SEO suggestion content) may pass with fallback/templates or require env in CI.

---

## 4. Failure behavior (no fake “done”)

- **!res.ok:** reportAiError; setAiBusyToolId(null); return; no onApplySuggestPatch.
- **parseBackofficeAiJson null / !parsed.ok:** reportAiError; return null; no apply.
- **parseSuggestPayload / parsePageBuilderResponse null:** reportAiError; no apply.
- **Stale response (effectiveIdRef !== requestContextId):** payload discarded for apply; result not set for page-bound state.
- **applyAIPatchV1 !applied.ok:** reportAiError; onApplySuggestPatch not called.
- **Blocks changed during request:** "Innholdet har endret seg. Forslag ble ikke brukt."; patch not applied.
- **503 FEATURE_DISABLED:** Route returns 503; client shows error; no fake success.

---

## 5. Exact files involved (summary)

| Role | Files |
|------|--------|
| Triggers / orchestration | ContentWorkspace.tsx, useContentWorkspaceAi.ts |
| Contracts / parsing | editorAiContracts.ts, editorAiContracts.test.ts |
| Apply | applyAIPatch.ts, aiPatch.ts (validateAIPatchV1); editorAiGuarantees.test.ts, aiSystemGuarantees.test.ts |
| API routes | app/api/backoffice/ai/suggest, page-builder, text-improve, cta-improve, seo-intelligence, block-builder, layout-suggestions, design-suggestion/log-apply, apply, capability; app/api/editor-ai/metrics |
| Provider / tools | lib/ai/provider.ts, editorTextSuggest.ts, lib/ai/tools/pageBuilder.ts, runSuggest (suggestMotor) |
| Logging | logEditorAiEvent.ts, editorAiMetricsTypes.ts; buildAiActivityLogRow, ai_activity_log |
| E2E | e2e/ai-cms.e2e.ts (SEO apply→save→GET; page builder append/replace→save→GET) |
| Apply route test | tests/api/backofficeAiApply.test.ts |

---

## 6. What is not verified here

- **Modal opening only** is not proof of AI (per requirement).
- **Text improve / CTA improve** end-to-end (trigger → request → response → apply) are not E2E-exercised.
- **Editor-AI metrics** ingest: unit tests cover route (auth, valid/invalid body, insert failure); E2E does not assert event stored in DB.
- **Capability** unavailable state (503 or enabled:false) is not asserted in E2E.
- **Provider failure** (e.g. timeout, 5xx) is handled in code (reportAiError, fallback where applicable) but not exercised in a dedicated failure E2E.

No new tests were added this pass. Existing coverage: contract parsing (editorAiContracts), apply safety (editorAiGuarantees, aiSystemGuarantees), apply route (backofficeAiApply), editor-ai metrics route (editorAiMetrics, editorAiMetricsPersistence), E2E SEO and page builder full path (ai-cms.e2e.ts). Failure-state E2E (e.g. 503 → UI error) would require env or mock; documented as PARTIAL where relevant.
