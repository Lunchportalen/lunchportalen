# Editor–AI observability model

**Purpose:** Editor AI actions, failures, and apply events are logged reliably enough for production CMS observability. Failures are distinguishable from success; apply events are recorded where apply happens; telemetry delivery is best-effort and never assumed.

## 1. Event types and pipeline

- **Source of truth (types):** `domain/backoffice/ai/metrics/editorAiMetricsTypes.ts` — `EditorAiEvent` union and `EditorAiFeature`.
- **Logger:** `domain/backoffice/ai/metrics/logEditorAiEvent.ts` — best-effort; never throws; no retry on 4xx/5xx or network failure. Delivery success is not guaranteed; calling `logEditorAiEvent` does not imply the event was stored.
- **Ingest:** `POST /api/editor-ai/metrics` — validates `type`, `timestamp`, optional `feature` (must be in VALID_FEATURES), writes to `ai_activity_log` with `action: "editor_ai_metric"`, `tool: <type>`. On insert failure returns 500 METRICS_INSERT_FAILED.

## 2. Success vs failure (distinguishable)

- **Success path events:** `editor_opened`, `ai_action_triggered`, `ai_result_received` (with `patchPresent`), `ai_patch_applied`, `ai_save_after_action`.
- **Failure/observability events:** `ai_error` (feature, message, kind), `media_error` (message, kind), `builder_warning` (feature, message, count), `content_error` (message, kind). Stored via same pipeline; no confusion with success events.

## 3. Workflow stages (trigger → result → apply vs skip)

- **Trigger:** `ai_action_triggered` with `feature` at action start (improve_page, seo_optimize, generate_sections, structured_intent, block_builder, screenshot_builder, page_builder, image_suggestions, etc.).
- **Result:** `ai_result_received` with `feature` and `patchPresent` when suggest/builder returns (patch may be absent for skip/no-change).
- **Apply:** `ai_patch_applied` with `feature` only when apply actually runs (onApplySuggestPatch, design suggestion apply, block insert, screenshot replace/append, page builder replace/append, hero image suggestion, visual_options in BlockInspector, **seo_recommendation** when user clicks Bruk on an SEO suggestion). Not emitted when apply is skipped (stale, wrong page, guard).
- **Save after action:** `ai_save_after_action` when user saves after an AI action (optional feature).
- **Errors:** `ai_error` on API/parse/network/target errors; `reportAiError` in hook and ContentWorkspace feeds this. `media_error` for media fetch/upload/alt; `builder_warning` for screenshot/page builder warnings; `content_error` for save/load/parse.

## 4. Feature parity (API vs types)

- **VALID_FEATURES** in `app/api/editor-ai/metrics/route.ts` must include every `EditorAiFeature` from `editorAiMetricsTypes.ts`, so events with `layout_suggestions` or `image_generate` (and all others) are accepted. Missing features would cause 400 invalid_feature and silent drop of events.

## 5. Telemetry failure (no silent assumption of health)

- Client does not retry on non-ok response or network error. In development, non-ok and send failures are logged to console (`[EDITOR_AI_METRICS] API returned ...` / `Failed to send event: ...`). Code must not assume "we called logEditorAiEvent" means "event was persisted"; the logger comment states this explicitly.

## 6. Call sites (summary)

- **useContentWorkspaceAi.ts:** ai_error, ai_result_received, ai_patch_applied, ai_action_triggered (multiple features), builder_warning (screenshot_builder, page_builder).
- **ContentWorkspace.tsx:** editor_opened, ai_save_after_action, ai_patch_applied (block_builder, screenshot_builder, image_suggestions, page_builder, **seo_recommendation**), ai_error (**seo_intelligence** on SEO analyse HTTP/result failure or network error), ai_action_triggered (image_suggestions), ai_result_received (image_suggestions), media_error.
- **BlockInspectorShell.tsx:** ai_patch_applied (visual_options).
- **MediaPickerModal.tsx:** media_error (fetch).
- **ContentWorkspaceLoader.ts:** content_error (load).
- **useContentWorkspaceSave.ts:** content_error (save).

## 7. SEO observability (operational only)

- **Suggestion generation:** `POST /api/backoffice/ai/seo-intelligence` writes to `ai_activity_log` with `action: "seo_intelligence_scored"`, `tool: "seo_intelligence"`, `metadata: { score, suggestionCount }`. On insert failure the route returns 500 SEO_INTELLIGENCE_LOG_FAILED and opsLogs; on bad request (invalid JSON / body not object) returns 400 and opsLogs `seo_intelligence.bad_request`; on compute throw opsLogs `seo_intelligence.compute_failed` and returns 500. Logging does not silently fail.
- **Apply:** When user applies an SEO recommendation (Bruk), ContentWorkspace emits `ai_patch_applied` with `feature: "seo_recommendation"` via logEditorAiEvent (best-effort). No server-side apply route for SEO; apply is client-only and logged via editor-ai metrics.
- **Failures:** Client logs `ai_error` with `feature: "seo_intelligence"` and `kind: "api"` or `"network"` when SEO analyse request fails or returns invalid result. Server logs all failure paths (bad_request, compute_failed, insert_failed) via opsLog.

## 8. Rules

- No broad analytics redesign; no vanity metrics. Only event types needed for production CMS observability (actions, results, apply, errors).
- Logged events match real workflow stages; apply events are emitted only when apply runs.
- Metrics API and VALID_FEATURES stay in sync with EditorAiFeature.
