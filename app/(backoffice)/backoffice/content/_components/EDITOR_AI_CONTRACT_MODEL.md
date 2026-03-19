# Editor–AI contract model

**Purpose:** Editor AI requests and responses use deterministic, structured contracts. Malformed responses fail safely; UI does not depend on ad-hoc provider shapes.

## 1. Request contracts

| Endpoint | Request shape | Source |
|----------|----------------|--------|
| **POST /api/backoffice/ai/suggest** | `SuggestRequest`: `tool`, `pageId`, `variantId`, `environment`, `locale`, `input`, `blocks`, `existingBlocks`, `meta`, `pageTitle?`, `pageSlug?` | Built in hook from `buildAiBlocks`, `buildAiMeta`, `buildAiExistingBlocks` and current editor state. |
| **POST /api/backoffice/ai/block-builder** | Body: `description`, `locale`, `pageId?` | Caller-provided. |
| **POST /api/backoffice/ai/page-builder** | Body: `locale`, `prompt?`, `pageId?`, `goal?`, `audience?`, `tone?`, `pageType?`, `ctaIntent?`, `sectionsInclude?`, `sectionsExclude?` | Caller-provided. |
| **POST /api/backoffice/ai/screenshot-builder** | Body: `screenshotUrl?`, `description?`, `locale`, `pageId?` | Caller-provided. |
| **POST /api/backoffice/ai/layout-suggestions** | Body: `blocks`, `title?`, `slug?`, `pageId?`, `locale` | Caller-provided. |
| **GET /api/backoffice/ai/capability** | No body. | — |

All request payloads are explicit objects; no ad-hoc or untyped request bodies.

## 2. Generic API response

Backoffice AI routes return either:

- **Success:** `{ ok: true, rid?, data: T }` (from `jsonOk(rid, data)`).
- **Error:** `{ ok: false, message?, error?, rid? }`.

**Parser:** `parseBackofficeAiJson(json: unknown)` → `BackofficeAiOk<unknown> | BackofficeAiErr | null`.  
- Returns `null` if JSON is not an object or lacks `ok`.  
- Use parsed result before reading `data` or `message`; malformed responses yield `null` and the editor reports "Ugyldig svar fra AI." and does not set state.

## 3. Normalized result shapes (internal)

Editor state and apply logic use only these shapes, not raw API payloads.

| Flow | Normalized type | Parser | When null |
|------|------------------|--------|-----------|
| **Suggest** | `SuggestPayload`: `summary?`, `patch?` (AIPatchV1), `metaSuggestion?` | `parseSuggestPayload(raw)` | `raw` not an object. |
| **Block builder** | `BlockBuilderResult`: `block`, `message` | `parseBlockBuilderResponse(data)` | `data` not object or `block` missing/invalid. |
| **Screenshot builder** | `ScreenshotBuilderResult`: `blocks`, `message?`, `blockTypes?`, `warnings?` | `parseScreenshotBuilderResponse(data)` | `data` not object or `blocks` not non-empty array. |
| **Layout suggestions** | `LayoutSuggestionsResult`: `suggestions` (array of `LayoutSuggestionItem`), `message` | `parseLayoutSuggestionsResponse(data)` | `data` not object or no valid suggestions. |
| **Layout item** | `LayoutSuggestionItem`: `kind`, `title`, `reason`, `priority`, `previewLabel?`, `applyPatch?` (AIPatchV1 only) | Inside layout parser | Invalid items dropped; `applyPatch` included only when `isAIPatchV1(s.applyPatch)`. |
| **Image generator** | `ImageGeneratorResult`: `url?`, `id?` | `parseImageGeneratorResponse(data)` | `data` not object or neither `url` nor `id` present. |
| **Page builder** | `PageBuilderResult`: `title?`, `summary?`, `blocks` (array of `PageBuilderBlock`), `warnings?`, `droppedBlocks?` | `parsePageBuilderResponse(data)` | `data` not object or no valid blocks. |
| **Capability** | `CapabilityResult`: `enabled` (boolean) | `parseCapabilityResponse(json)` | `json` not object or no `enabled` at top-level or `data.enabled`. |

Distinction of result content:

- **Suggestion text:** `SuggestPayload.summary`, `BlockBuilderResult.message`, `LayoutSuggestionsResult.message`, `PageBuilderResult.summary`.
- **Structured content:** `SuggestPayload.patch` (apply payload), `ScreenshotBuilderResult.blocks`, `PageBuilderResult.blocks`, `LayoutSuggestionItem.applyPatch`.
- **Errors/warnings:** API errors via `parseBackofficeAiJson` → `BackofficeAiErr.message`; builder warnings in `ScreenshotBuilderResult.warnings`, `PageBuilderResult.warnings` / `droppedBlocks`.

## 4. Safe parsing and fail-closed behavior

- **Before using any API response:** Call `parseBackofficeAiJson(json)`. If `null` or `!parsed.ok`, do not set result state; report error and return.
- **Before setting suggest state:** Call `parseSuggestPayload(parsed.data)`. If `null`, report "Ugyldig svar fra AI." and do not set summary/patch state or apply.
- **Before setting builder state:** Call the corresponding parser (`parseBlockBuilderResponse`, etc.). If parser returns `null`, do not set that result state (no apply, no display of that result).
- **Capability:** Use `parseCapabilityResponse(json)`; if `null`, treat as `enabled: false` (unavailable).
- **Patch apply:** Only apply when `payload.patch` is present (suggest) or `suggestion.applyPatch` is present and `isAIPatchV1(…)` (layout). Apply logic uses only these validated shapes.

## 5. Files

| File | Role |
|------|------|
| `editorAiContracts.ts` | Request/response types, `parseBackofficeAiJson`, `parseSuggestPayload`, all builder/capability parsers. Single place for editor–AI contracts. |
| `useContentWorkspaceAi.ts` | Builds `SuggestRequest`; calls parsers on every AI response; sets state only from parsed results; reports error and skips state when parser returns `null`. |
| `contentWorkspace.ai.ts` | Request builders: `buildAiBlocks`, `buildAiExistingBlocks`, `buildAiMeta`; error message normalization for API errors. |
| `lib/cms/model/aiPatch.ts` | `AIPatchV1` type and `isAIPatchV1` guard; used by contracts and apply path. |

## 6. Summary

- **Requests:** Explicit structured payloads; suggest body typed as `SuggestRequest`.
- **Responses:** Single generic parse (`parseBackofficeAiJson`) then tool-specific parsers; all return typed shapes or `null`.
- **Malformed:** Parsers return `null`; editor reports error and does not set result or apply.
- **UI:** Consumes only normalized result types (e.g. `SuggestPayload`, `BlockBuilderResult`); no ad-hoc provider fields.
- **Patch/apply:** Only validated `AIPatchV1` from suggest payload or layout suggestion item is applied.
