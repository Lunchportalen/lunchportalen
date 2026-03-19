# Editor–AI apply/reject safety model

**Purpose:** AI suggestions are applied or rejected safely without corrupting editor truth. Apply updates only the intended target; reject/cancel leaves content untouched.

## 1. Single writer for AI-applied content

- **Entry point:** `onApplySuggestPatch(editorBlocks, mergedMeta)` in ContentWorkspace is the only path that mutates editor state for **suggest (patch)** and **design (layout) suggestion** apply.
- **Implementation:** Calls `applyParsedBody(parseBodyToBlocks({ blocks: editorBlocks, meta: safeMeta }))`. Reject/cancel never calls this callback; content stays untouched.
- **Fail-closed:** If `editorBlocks` is not an array, or `mergedMeta` is not a plain object, the callback returns without mutating. No partial or malformed payload is written.

## 2. Patch apply (suggest: improve, SEO, generate sections)

- **Flow:** Response payload is parsed to `SuggestPayload`; only when `payload.patch` is present and valid (`AIPatchV1`), `applyAIPatchV1(bodyForApply, patch)` is called.
- **Rule:** `onApplySuggestPatch` is called **only when** `applied.ok === true`. If `applied.ok === false` (block not found, index out of range, invalid op), we report error and **do not** call `onApplySuggestPatch`. So partial or malformed patch never reaches the editor.
- **Target:** Patch is applied to **current** `blocks` and `meta` (bodyForApply). Result is the full new block list and meta; we pass `applied.next.blocks` and merged meta. So we replace the draft with the patched result, not with unrelated content.
- **Reject:** There is no explicit “reject” button for this path; apply is automatic when patch is valid. User can undo or not save. Stale response is never applied (stale guard in hook).

## 3. Design (layout) suggestion apply

- **Flow:** User clicks Apply on a suggestion. `handleApplyDesignSuggestion` runs only when `suggestion.applyPatch` exists and `isAIPatchV1(suggestion.applyPatch)`.
- **Rule:** `bodyForApply` is built from **current** `blocks` and `meta`. We call `applyAIPatchV1(bodyForApply, suggestion.applyPatch)`. If `!applied.ok`, we report error and **return without** calling `onApplySuggestPatch`. So invalid or inapplicable patch never mutates state.
- **Reject:** **Dismiss** = `handleDismissDesignSuggestion(suggestion)`. It only updates `designSuggestionsDismissed` (UI state). No editor mutation; content is untouched.

## 4. Page / screenshot builder Replace and Append

- **Replace:** User must confirm; then we call `applyParsedBody(parseBodyToBlocks({ blocks: editorBlocks, meta: {} }))` or (screenshot) same. We only run when:
  - Result is for current page (`result.pageId == null || result.pageId === effectiveId`).
  - Normalized `editorBlocks.length > 0` (else we report error and return).
- **Append:** Same page check; we `setBlocks((prev) => [...prev, ...editorBlocks])`. No replace of existing blocks; only append.
- **Reject:** User does not click Replace/Append; no callback runs; editor content is untouched. Result can be cleared on page change (effect in hook).

## 5. Block builder Insert

- **Flow:** User clicks Insert. We check `aiBlockBuilderResult.pageId == null || aiBlockBuilderResult.pageId === effectiveId`; else report error and return. Then we normalize the block and insert at index or append.
- **Target:** Single block inserted via `setBlocks` (splice or append). No overwrite of unrelated blocks.
- **Reject:** User does not click Insert; no mutation. Result cleared on page change.

## 6. Hero image suggestion

- **Flow:** `applyHeroImageSuggestion(blockId, suggestion)` updates only the block with `blockId` via `setBlockById(blockId, updater)`. No other blocks or meta are touched.
- **Reject:** User does not pick a suggestion; no mutation.

## 7. Integration with save/autosave

- **State:** All apply paths update the same editor state (`blocks`, `meta`) that `bodyForSave` is derived from. So after apply, the draft is updated and dirty state is recalculated; save/autosave will persist the new content. No separate “AI branch”; one source of truth.
- **No bypass:** We do not write to server or outbox directly from AI apply; we only update React state. Save flow is unchanged.

## 8. Summary

| Action | Apply path | Reject / cancel | Safety |
|--------|------------|------------------|--------|
| Suggest (patch) | `onApplySuggestPatch` only when `applyAIPatchV1(…).ok` | No call; user can undo / not save | Stale guard; no apply on invalid patch. |
| Design suggestion | `onApplySuggestPatch` only when `applied.ok` | Dismiss = UI only, no mutation | Patch validated; wrong-page result not applied (same page). |
| Page/Screenshot Replace | `applyParsedBody` after confirm; pageId check; non-empty blocks | User does not confirm | Target page and empty-block checks. |
| Page/Screenshot Append | `setBlocks([...prev, ...editorBlocks])`; pageId check | User does not click Append | Append only; no overwrite. |
| Block builder Insert | `setBlocks` (splice/append); pageId check | User does not click Insert | Single-block insert; page check. |
| Hero image suggestion | `setBlockById(blockId, …)` | User does not pick | Single-block update. |

- **Apply updates only the intended target:** Patch applies to current body; Replace/Append use result for current page; Insert adds one block; hero updates one block by id.
- **Reject/cancel leaves editor untouched:** No call to `onApplySuggestPatch` or `applyParsedBody` or `setBlocks`/`setBlockById` for the AI result.
- **No silent overwrite of unrelated content:** Full replace only with patched or builder result for current page; append/insert are additive or single-block.
- **Partial/malformed results do not corrupt state:** Parsers return null and we don’t set result state; apply uses only validated patch or normalized blocks; `onApplySuggestPatch` ignores non-array `editorBlocks` or non-object meta.
