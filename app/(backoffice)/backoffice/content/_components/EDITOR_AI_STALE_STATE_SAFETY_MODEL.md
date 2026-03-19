# Editor–AI stale-state and concurrency safety model

**Purpose:** Delayed AI responses cannot apply to the wrong or outdated editor state. Overlapping requests are handled deterministically; fast user edits during AI generation do not corrupt content when structure has changed.

## 1. Request identity and stale response rejection

- **Page context:** At the start of every AI request we set `requestContextId = effectiveId` (the page id when the request was sent). We keep `effectiveIdRef.current` in sync with `effectiveId` via `useEffect`.
- **Stale guard:** When an async response is received we compute `isStaleResponse = effectiveIdRef.current !== requestContextId`. When true:
  - We **do not** set any page-bound result state (e.g. `setAiPageBuilderResult`, `setAiBlockBuilderResult`, `setAiSummary`, etc.).
  - We **do not** call `onApplySuggestPatch` or otherwise mutate editor state.
  - We return the payload (or data) without applying so callers can still use it if needed; the UI does not show or apply it for the current page.
- **Where applied:** Same guard is used in `callAiSuggest`, `callDedicatedAiRoute`, and `handlePageBuilder`. So stale responses (user switched page before response arrived) never patch or update the editor.

## 2. Block-structure guard (suggest patch only)

- **Problem:** If the user adds or removes blocks while a suggest request is in flight, the patch was computed for the **previous** block list. Applying it to the **current** list can be wrong (e.g. indices or targets no longer match intent).
- **Guard:** At request start we store `blocksLengthAtRequest = blocks.length`. Before applying a suggest patch we check `blocks.length === blocksLengthAtRequest`. If they differ we **do not** apply; we set a user-facing summary ("Innholdet har endret seg. Forslag ble ikke brukt.") and return. The patch is effectively rejected; editor content is untouched.
- **Scope:** This guard runs only for the suggest (patch) apply path in `callAiSuggest`. Builder flows (page/screenshot/block) are user-triggered apply after result is shown and already bound to page; they do not auto-apply.

## 3. Multiple overlapping AI requests

- **Serialization:** `shouldStartAiAction(aiBusyToolId, requestedId)` returns `false` whenever `aiBusyToolId` is non-null. So only one AI action (any tool) can be in progress at a time. A new request (same or different tool) is not started until the current one finishes and `setAiBusyToolId(null)` runs in `finally`.
- **Entry points:** All AI triggers go through this check: `callAiSuggest`, `callDedicatedAiRoute`, and `handlePageBuilder` all call `shouldStartAiAction` (or equivalent for page builder) before starting the request. So overlapping requests are not started; handling is deterministic (first-come, one at a time).

## 4. Fast user edits during AI generation

- **Same page, structure unchanged:** If the user only edits **content** inside existing blocks (no add/remove), we still apply the patch when the response arrives (same page, same block count). The patch is applied to **current** blocks; `applyAIPatchV1` merges op data into the current block list. So the latest content is what gets patched. Edits in blocks that the patch does not touch remain; edits in blocks that the patch updates are overwritten by the patch. This is accepted product behavior (no version merge).
- **Same page, structure changed:** If the user added or removed blocks, we skip apply (block-structure guard) and show "Innholdet har endret seg. Forslag ble ikke brukt." So we do not apply a patch that was computed for a different structure; final content is not corrupted by an outdated patch.
- **Page changed:** Stale guard ensures we do not set result or apply for the old page. Result state for the previous page is cleared when `effectiveId` changes (useEffect in the hook).

## 5. Save/autosave and AI apply

- **Single draft:** AI apply updates the same editor state (`blocks`, `meta`) that save/autosave use. We only call `applyParsedBody` or `setBlocks`/`setBlockById`; we do not write to server or outbox from the AI path. So there is no separate "AI branch" or ambiguous state.
- **Dirty and autosave:** After apply, the draft is updated and `bodyForSave` / dirty state are derived from that. Autosave (if enabled) will persist the new state on its next run. No extra version or conflict is introduced by AI apply; it is just another edit to the draft.

## 6. Outdated AI results: rejected or unusable

- **Stale response:** Rejected by the stale guard; no state update and no apply.
- **Structure changed:** Rejected by the block-structure guard; summary set to "Innholdet har endret seg. Forslag ble ikke brukt." and no apply.
- **Wrong page apply:** Builder apply handlers (Replace/Append/Insert) check `result.pageId == null || result.pageId === effectiveId`. If the result is for another page we report error and do not apply; result is effectively unusable for the current page.
- **Page change:** When `effectiveId` changes we clear page-bound AI result state (e.g. `setAiPageBuilderResult(null)`, `setAiBlockBuilderResult(null)`). So outdated results are not shown or applied after navigation.

## 7. Capability and other async effects

- **Capability fetch:** The effect that fetches `/api/backoffice/ai/capability` uses a `cancelled` flag. In the response `.then` we check `if (cancelled) return` before calling `setAiCapability`. Cleanup sets `cancelled = true`. So we do not update capability state after the effect has re-run (e.g. after `selectedId` change) or unmount.

## 8. Summary

| Mechanism | Role |
|-----------|------|
| `requestContextId` + `effectiveIdRef` | Reject stale responses (wrong page); no set state, no apply. |
| `blocksLengthAtRequest` | Reject suggest-patch apply when block count changed; show message, no apply. |
| `shouldStartAiAction` / `aiBusyToolId` | Allow only one AI request at a time; deterministic, no overlapping in-flight requests. |
| Result `pageId` + apply handlers | Builder apply only when result is for current page; otherwise error and no apply. |
| Clear result state on `effectiveId` change | Outdated results are not shown or applied after page switch. |
| Single draft + no AI-side save | Save/autosave and AI apply share the same state; no ambiguous or duplicate state. |
