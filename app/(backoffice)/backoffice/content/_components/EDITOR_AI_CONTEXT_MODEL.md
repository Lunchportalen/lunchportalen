# Editor-AI context-binding model

**Purpose:** Ensure every AI action is bound to the correct page, block, field, and current editor state. Fail closed on ambiguous or missing targets.

## 1. Identity and truth

| Concept | Source of truth | Used for |
|--------|------------------|----------|
| **Current page** | `effectiveId` (ContentWorkspace) | All page-scoped AI: request body `pageId`, stale guard, apply checks. |
| **Request context** | `requestContextId = effectiveId` at request start | Stale guard: do not set result or apply when `effectiveIdRef.current !== requestContextId`. |
| **Editor state** | `blocks`, `meta`, `title`, `slug` from hook deps | Context payload: `buildAiBlocks(blocks)`, `buildAiMeta(meta)`, etc. Built at call time from current state. |
| **Result page binding** | `pageId` on stored results | Page builder, screenshot builder, block builder: apply only when `effectiveId === result.pageId` (or `pageId` null/absent). |

## 2. Page-level binding

- **Before request:** Page-scoped actions (e.g. page builder) require `effectiveId`. If `!effectiveId`, do not send; report error and return.
- **Request body:** Always send `pageId: effectiveId ?? null` (or `undefined`) so the API knows the target page.
- **After response:** Stale guard in `callAiSuggest`, `callDedicatedAiRoute`, and `handlePageBuilder`: only set page-bound state when `effectiveIdRef.current === requestContextId`.
- **On apply:** Page builder and screenshot builder Replace/Append check `result.pageId != null && effectiveId !== result.pageId` → report error and do not apply. Block builder Insert checks `result.pageId != null && effectiveId !== result.pageId` → report error and do not insert.

## 3. Block-level binding

- **Patch tools (suggest):** Patch ops reference block `id`. `applyAIPatchV1` validates targets exist; if block not found, returns `{ ok: false, reason }`. Apply path never calls `onApplySuggestPatch` when `!applied.ok`.
- **Design suggestions (layout):** Each suggestion carries `applyPatch`; apply uses current `blocks`/`meta` and `applyAIPatchV1`; on failure report error and do not apply.
- **Hero image suggestion:** `applyHeroImageSuggestion(blockId, suggestion)` — target block is explicit; `setBlockById(blockId, …)`.
- **Block builder:** Result is one block; stored with `pageId`; insert checks page before mutating.

## 4. Field-level binding

- **Patch ops:** `updateBlockData` targets block by `id` and merges `op.data` into that block’s data (field-level within the block). No separate field id; block + data keys define the target.
- **SEO / improve:** Meta suggestions (title, description) merged into `meta`; block text changes via patch ops. No standalone “field” handle beyond block id + data.

## 5. Context payload construction

- **Source:** Always from current hook inputs: `blocks`, `meta`, `title`, `slug`, `effectiveId`. No cached or stale UI state.
- **Suggest body:** `buildAiBlocks(blocks)`, `buildAiExistingBlocks(blocks)`, `buildAiMeta(meta)`, `pageTitle: title`, `pageSlug: slug`, `pageId: effectiveId ?? null`.
- **Dedicated routes:** Caller passes same `effectiveId` / `pageId` in body; request context captured at call time.

## 6. Fail-closed rules

- Missing page for page-scoped action → do not send; report error.
- Stale response (user switched page during request) → do not set result; do not apply.
- Apply only when `effectiveId === result.pageId` (when `result.pageId` is set).
- Patch apply only when `applyAIPatchV1(…).ok`; otherwise report error and do not call `onApplySuggestPatch`.
- Invalid or missing target in patch (block not found, etc.) → `applyAIPatchV1` returns `ok: false`; caller does not apply.

## 7. Files that enforce context binding

| File | Responsibility |
|------|----------------|
| `useContentWorkspaceAi.ts` | `requestContextId` at request start; stale guard with `effectiveIdRef.current !== requestContextId`; `pageId` on block/screenshot/page builder results; no page-builder run when `!effectiveId`. |
| `ContentWorkspace.tsx` | `onApplySuggestPatch`; Replace/Append/Insert handlers check `result.pageId` vs `effectiveId` before apply; `reportAiError` on target mismatch. |
| `contentWorkspace.ai.ts` | `buildAiBlocks`, `buildAiExistingBlocks`, `buildAiMeta` from current blocks/meta. |
| `lib/cms/model/applyAIPatch.ts` | Pure apply; fail-closed on invalid op or missing block. |
