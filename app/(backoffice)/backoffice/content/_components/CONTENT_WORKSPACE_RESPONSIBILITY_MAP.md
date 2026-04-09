# ContentWorkspace.tsx — VERIFIED Responsibility Map (Step 0)

**File:** `app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx`  
**Approx size:** ~6620 lines  
**No code changed in this step.**

---

## 1. Pure helpers (stateless / near-stateless) — Lines ~84–712

| Symbol | Purpose |
|--------|--------|
| `looksMojibakeText` | Detect mojibake in string |
| `AI_TOOL_TO_FEATURE` | Map AI tool id → EditorAiFeature for metrics |
| `looksMojibakeAny` | Mojibake check for any value (JSON stringified) |
| `makeRidClient` | Generate client request id (crypto.randomUUID or fallback) |
| `safeStr` | `String(v ?? "").trim()` |
| `safeObj` | Safe cast to `Record<string, unknown>` |
| `buildAiBlocks` | Map editor Block[] → AI API block shape |
| `rankHeroMediaSuggestions` | Score/filter hero image suggestions by context tokens |
| `buildAiExistingBlocks` | Map blocks to `{ id, type }[]` for AI |
| `buildAiMeta` | Page AI contract → `{ description?, title? }` for suggest |
| `normalizeSlug` | Slug normalization (lowercase, dashes, trim) |
| `formatDate` | Format date for display (formatDateTimeNO or raw) |
| `extractAiSummary` | Extract user-facing summary from AI tool response |
| `makeSnapshot` | Serialize title/slug/body for dirty comparison |
| `readApiMessage` | Read `message` from API error payload |
| `readApiRid` | Read `rid` from API payload |
| `readApiError` | Build user-facing error string from status + payload |
| `parseJsonSafe` | `res.json()` with try/catch → ApiResponse \| null |
| `makeBlockId` | Generate block id (blk_...) |
| `createBlock` | Create empty Block by type |
| `isAddModalBlockTypeFromOverlay` | Type guard for block type from overlay |
| `blockTypeSubtitle` | Human-readable subtitle for block type |
| `normalizeBlock` | Raw unknown → Block \| null (per-type fields) |
| `normalizeBlocks` | Raw unknown → Block[] |
| `looksJsonLike` | Heuristic: string starts with { or [ |
| `toRawBodyString` | body → string (for parse input) |
| `parseBodyToBlocks` | body (unknown) → BodyParseResult |
| `serializeBlocksToBody` | blocks + meta → JSON string |
| `deriveBodyForSave` | mode + blocks + meta + legacy/invalid → body string |
| `deriveBodyFromParse` | BodyParseResult → body string |

**Local types (same region):**  
`ContentPageListItem`, `ContentPage`, `ListData`, `CreateData`, `PageData`, `ApiOk`, `ApiErr`, `ApiResponse`, `BodyMode`, `BodyParseResult`, `AiToolId`.

---

## 2. Data loading

| Cluster | State | Effect / trigger |
|---------|--------|------------------|
| **List** | `queryInput`, `query`, `items`, `listLoading`, `listError`, `listReloadKey` | Debounced query (180ms) from queryInput → query. Effect on `[query, listReloadKey]` → `syncAndLoadList()` (GET `/api/backoffice/content/pages`, optional forside seed). |
| **Detail** | `page`, `detailLoading`, `detailError`, `pageNotFound`, `refetchDetailKey`, `isOffline` | Effect on `[selectedId, applyParsedBody, refetchDetailKey]` → `loadPage()`. GET page by selectedId, parse body envelope, `applyParsedBody(parsedBody)`, set savedSnapshot, outbox reconciliation. |
| **Selected id** | `selectedId = safeStr(initialPageId)` | From props. `effectiveId = page?.id ?? selectedId` for API calls. |

---

## 3. Content page / editor model state

| State | Purpose |
|-------|--------|
| `title`, `slug`, `slugTouched` | Page header fields; slug derived from title when not touched. |
| `bodyMode` | "blocks" \| "legacy" \| "invalid" |
| `blocks`, `meta` | Current block list and meta (editor truth). |
| `legacyBodyText`, `invalidBodyRaw`, `bodyParseError` | Legacy/invalid body UI and error. |
| `documentTypeAlias`, `envelopeFields` | Umbraco-style envelope (documentType + fields). |
| `bodyForSave` | useMemo: deriveBodyForSave + optional envelope serialization. |
| `currentSnapshot` | useMemo: makeSnapshot({ title, slug, body: bodyForSave }). |
| `dirty` | useMemo: currentSnapshot !== savedSnapshot (when page loaded). |
| `applyParsedBody` | In `useContentWorkspaceBlocks`: sets bodyMode, blocks, meta, legacy/invalid, bodyParseError. Shell wraps caller to sync `selectedBlockId` (canonical block focus). |
| **Editor2** | `useEditor2` (false), `editor2Model`, `editor2SelectedBlockId`, `editor2FocusNonce`, `editor2ResetSearchNonce`, refs for focus/search. | Read-only adapter from page.body when useEditor2; validation from validateModel. |

---

## 4. Save state / conflict / autosave pipeline

| Item | Purpose |
|------|--------|
| **Save state** | `saveState`, `setSaveStateSafe`, `lastServerUpdatedAt`, `lastSavedAt`, `lastError`, `savedSnapshot`. |
| **Outbox** | `recoveryBannerVisible`, `outboxData`, `outboxDetailsExpanded`, `outboxCopyFeedback`; sessionRidRef. Refs: dirtyRef, savingRef, skipNextAutosaveScheduleRef, pendingSaveRef, performSaveRef, saveSeqRef, activeAbortRef, statusSeqRef, statusAbortRef, statusInProgressRef; autosaveTimerRef, outboxWriteTimerRef. |
| **Actions** | `clearAutosaveTimer`, `patchPage(partial, message, { syncEditor?, signal? })`, `performSave()`, `saveDraft(source)`. |
| **Derived** | `currentServerFingerprint`, `hasFingerprintConflict` (outbox vs server). |
| **Outbox UI** | `onRestoreOutbox`, `onDiscardOutbox`, `buildOutboxExportSnapshot`, `copyOutboxSafetyExport`. |
| **Save triggers** | `onSave` (validation + saveDraft), `onSaveAndPreview` (save + open preview URL). |
| **Autosave effect** | When dirty and conditions OK: clear timer, skip first schedule after load, then setTimeout(800) → saveDraft("autosave"); cleanup clears timer. |
| **Outbox write effect** | When dirty and page loaded: debounce 250ms → writeOutbox(draft); cleanup clears timer. |

---

## 5. Block model handling (editor actions)

| Item | Purpose |
|------|--------|
| `setBlockById` | Update single block by id (media picker, AI rich-text apply, same `blocks` truth). |
| `onAddBlock` | createBlock, set bodyMode blocks, append block; shell focuses new block via `selectedBlockId`. |
| `onMoveBlock`, `onDeleteBlock` | Reorder, remove (canonical list = `blocks`). |
| `selectedBlockId` | `useContentWorkspaceUi` — single focus truth for canvas, inspector, actions (no parallel `expandedBlockId`). |
| `onFillForsideFromRepo`, `onConvertLegacyBody`, `onResetInvalidBody` | Legacy/invalid → blocks. |

---

## 6. Preview / public page opening

| Item | Purpose |
|------|--------|
| `publicSlug` | useMemo: normalizeSlug(slug \|\| page?.slug). |
| `canOpenPublic` | Boolean(publicSlug). |
| `onOpenPublicPage` | window.open(`/${publicSlug}`, "_blank"). |
| **Preview (backoffice)** | `onSaveAndPreview`: save then window.open(`/backoffice/preview/${selectedId}`). |

---

## 7. AI wiring (suggest/apply + dedicated routes)

| Item | Purpose |
|------|--------|
| **State** | `aiBusyToolId`, `aiError`, `aiSummary`, `aiBlockBuilderResult`, `aiPageBuilderResult`, `aiScreenshotBuilderResult`, `lastGeneratedImageResult`, `aiLastAppliedTool`, `aiLastActionFeature`; `aiCapability`, `mediaHealthStatus`; `diagnosticsResult`, `diagnosticsBusy`; `aiHistory`, `pushAiHistory`; `reportAiError`. |
| **Suggest** | `callAiSuggest(tool, input, { metricsFeature })`: POST suggest, parse payload, extract summary, apply AIPatchV1 when patch present, call applyParsedBody, pushAiHistory, log metrics. |
| **Dedicated routes** | `callDedicatedAiRoute({ path, body, busyId, getSummary })`: POST path, set result state (block builder, screenshot builder, image generator), getSummary → setAiSummary. |
| **Handlers** | handleAiImprovePage, handleAiSeoOptimize, runFullDiagnostics, handleAiGenerateSections, handleAiStructuredIntent, handleAiImageGenerate, handleAiImageImproveMetadata, handleFetchImageAltFromArchive; handleLayoutSuggestions, handleBlockBuilder, handleBlockBuilderInsert; screenshotResultToEditorBlocks, handleScreenshotBuilderReplace/Append, handleScreenshotBuilder; handleHeroImageSuggestions, handleBannerVisualOptions; handlePageBuilder, pageBuilderResultToEditorBlocks, handlePageBuilderReplace/Append. |
| **Effects** | Editor opened log once per page; AI capability fetch when selectedId; media health fetch when selectedId. |

---

## 8. Media picker wiring

| Item | Purpose |
|------|--------|
| `useMediaPicker({ setBlockById })` | Returns: `mediaPickerOpen`, `mediaPickerTarget`, `openMediaPicker`, `closeMediaPicker`, `applyMediaSelection`. Used for block image/asset fields. |

---

## 9. Publish / workflow actions

| Item | Purpose |
|------|--------|
| `onSetStatus` | PATCH page status (published/draft), merge with local title/slug/body, update page and save state, set statusFeedback. Uses statusSeqRef/statusAbortRef. |
| `useContentSaveStatus` | Inputs: saveState, dirty, isOffline, lastSavedAt, lastError, formatDate, page, selectedId, detailLoading, isStatusInProgress, hasConflict. Outputs: statusLine, statusLabel, statusBadgeClass, canPublish, canUnpublish, publishDisabledTitle, unpublishDisabledTitle. |
| `isStatusInProgress`, `statusFeedback` | UI for status action in progress and brief success message. |

---

## 10. Modal / panel state (UI only)

| Group | State |
|-------|--------|
| **Block modals** | `addBlockModalOpen`, `editOpen`, `editIndex`, `blockPickerOpen`. |
| **Create panel** | `createPanelOpen`, `createPanelMode`, `createTitle`, `createSlug`, `createSlugTouched`, `creating`, `createError`, `createDocumentTypeAlias`, `allowedChildTypes`, `createParentLoading`. |
| **Main view / global / design** | `mainView` (page \| global \| design), `globalPanelTab`, `globalSubView`, `headerVariant`, `headerEditConfig`, `headerEditLoading`, `headerEditSaving`, `headerEditError`; `contentSettingsTab`, `navigationTab`, `designTab`, `footerTab`, `bannerPanelTab`, `bannerSettingsSubTab`. |
| **Navigation toggles** | `hideMainNavigation`, `hideSecondaryNavigation`, `hideFooterNavigation`, `hideMemberNavigation`, `hideCtaNavigation`, `hideLanguageNavigation`. |
| **Design/colors** | `colorsContentBg`, `colorsButtonBg`, `colorsButtonText`, `colorsButtonBorder`, `labelColors`, `contentDirection`; design section state. |
| **Other** | `notificationEnabled`, `multilingualMode`, `emailPlatform`, `captchaVersion`; `selectedBannerItemId`, `bannerVisualOptions`; `heroImageSuggestions`; `showPreviewColumn`; `activeTab` (innhold \| ekstra \| …). |

---

## 11. Top status / dirty derivation and support

| Item | Purpose |
|------|--------|
| **Save status** | `saveStatus` from useContentSaveStatus; `saving`, `hasConflict`, `isPublished`; `canSaveBase`, `canSave` (with block validation). |
| **Support snapshot** | `supportSnapshot` (useMemo when conflict/offline/error), `copySupportSnapshot`; `statusFeedback`; block validation error: `blockValidationError`, `setBlockValidationError`. |
| **Validation** | `useBlockValidation(showBlocks, blocks)` → `blocksValidation`, `hasBlockingBlockValidationErrors`, `blockValidationError`, `setBlockValidationError`. |

---

## 12. Side panel / tab selection

| Item | Purpose |
|------|--------|
| `activeTab` | innhold \| ekstra \| oppsummering \| navigasjon \| seo \| aimaal \| scripts \| avansert. |
| **ContentSidePanel** | Renders tabs and content for activeTab; receives tab state and setters. |
| **ContentMainShell** | Main editor area (blocks list, preview column, Editor2 shell when used). |

---

## 13. Navigation / selected page sync

| Item | Purpose |
|------|--------|
| `selectedId` | From `initialPageId` (URL). |
| `onSelectPage(nextId)` | setMainView("page"), guardedPush to `/backoffice/content/${nextId}`. |
| `guardedPush(href)` | If dirty, confirm; clearAutosaveTimer; router.push(href). |
| `onReloadFromServer` | clearAutosaveTimer; setRefetchDetailKey(k => k+1). |
| **Clear on no selection** | When !selectedId: reset page, title, slug, body state, save state, outbox, etc. |

---

## 14. Create page flow

| Item | Purpose |
|------|--------|
| **State** | createTitle, createSlug, creating, createError, createDocumentTypeAlias, allowedChildTypes, createParentLoading (see Modal/panel state). |
| **Effect** | When createPanelOpen and selectedId: fetch parent page, parse body envelope, get DocumentType allowedChildren → setAllowedChildTypes. |
| **onCreate** | Validate title/slug; POST `/api/backoffice/content/pages` (optional body envelope); listReloadKey++; close panel; guardedPush to new page id. |

---

## 15. Editor UI composition (render)

| Area | Components / structure |
|------|------------------------|
| **Layout** | Grid: sidebar (when !hideLegacySidebar) + main. |
| **Sidebar** | Hjem (single/double click), Global, Design, Recycle Bin; search (queryInput); page list (items, onSelectPage). Create panel (modal/panel). |
| **Main** | ContentTopbar (title/slug, status, actions); ContentMainShell (blocks, preview, Editor2); ContentSidePanel (tabs); ContentSaveBar; ContentConflictPanel; ContentRecoveryPanel; ContentTopStatusPanel; ContentAiTools; BlockAddModal; BlockEditModal; MediaPickerModal; BlockPickerOverlay; ContentInfoPanel; ContentSeoPanel; etc. |

---

## Extraction readiness (for later steps)

| Cluster | Safe to extract as | Notes |
|---------|--------------------|--------|
| Pure helpers | `contentWorkspace.helpers.ts` + `contentWorkspace.blocks.ts` + `contentWorkspace.api.ts` | No React; only imports: formatDateTimeNO, parseMetaToPageAiContract, contractToAiMetaShape (blocks/api may need minimal types). |
| Save/autosave | `useContentWorkspaceSave.ts` | Needs: patchPage, applyParsedBody, bodyForSave, title, slug, page, selectedId, effectiveId, isOffline, updateSidebarItem, router; refs for autosave/outbox. Single source of truth for saveState, lastSavedAt, lastError, performSave, saveDraft, clearAutosaveTimer. |
| Block model | `useContentWorkspaceBlocks.ts` + `useContentWorkspaceUi.ts` | Blocks hook owns: bodyMode, blocks, meta, legacy/invalid, applyParsedBody, bodyForSave, setBlockById, onAdd/Move/Delete. UI hook owns: `selectedBlockId` (focus). See `lib/cms/workspaceBlockDatasetCanon.ts`. |
| AI | `useContentWorkspaceAi.ts` | callAiSuggest/callDedicatedAiRoute + handlers; depends on blocks, meta, title, slug, effectiveId, applyParsedBody, setBlockById, pushAiHistory, reportAiError. Shared state with editor (applyParsedBody). |
| Modal/panel UI | `useContentWorkspaceUiState.ts` | Many setState for modals/tabs; low risk if only state bundles, no logic. |

---

---

## Post-extraction state (after Step 1 + Step 3)

### Extracted files

| File | Owns |
|------|------|
| `contentWorkspace.helpers.ts` | safeStr, safeObj, normalizeSlug, formatDate, makeRidClient, looksMojibakeText, looksMojibakeAny, makeSnapshot, extractAiSummary |
| `contentWorkspace.api.ts` | ApiOk, ApiErr, ApiResponse, readApiMessage, readApiRid, readApiError, parseJsonSafe |
| `contentWorkspace.blocks.ts` | BodyMode, BodyParseResult, makeBlockId, createBlock, isAddModalBlockTypeFromOverlay, blockTypeSubtitle, normalizeBlock, normalizeBlocks, looksJsonLike, toRawBodyString, parseBodyToBlocks, serializeBlocksToBody, deriveBodyForSave, deriveBodyFromParse |
| `useContentWorkspaceBlocks.ts` | bodyMode, blocks, meta, legacyBodyText, invalidBodyRaw, bodyParseError, bodyForSave (derived), applyParsedBody, setBlockById, onAddBlock, onMoveBlock, onDeleteBlock |
| `useContentWorkspaceUi.ts` | selectedBlockId (canonical block focus) |

### Not extracted (and why)

- **Save/autosave pipeline (Step 2):** Too tightly coupled to patchPage, applyParsedBody, updateSidebarItem, and many state updaters; extracting would require a hook with 20+ parameters and unclear ownership of savedSnapshot/dirty.
- **AI wiring (Step 4):** AI state and callAiSuggest/callDedicatedAiRoute are interwoven with editor state (blocks, meta, applyParsedBody); extracting would risk double truth or a very large hook interface.
- **Modal/panel UI state (Step 5):** Skipped to avoid cosmetic-only change; would only bundle setState calls without reducing orchestration density meaningfully.

### ContentWorkspace size

- Before: ~6620 lines  
- After: ~6198 lines  
- Reduction: ~422 lines (~6.4%)

*End of responsibility map.*
