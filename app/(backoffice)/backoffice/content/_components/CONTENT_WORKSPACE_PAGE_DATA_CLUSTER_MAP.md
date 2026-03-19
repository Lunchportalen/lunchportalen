# ContentWorkspace — VERIFIED data loading / page orchestration cluster map

## A. Safe-to-extract (hook owns or runs)

| Item | Purpose |
|------|--------|
| **items / setItems** | Sidebar list; hook owns state. |
| **listLoading / listError / listReloadKey** | List fetch state; hook owns. |
| **syncAndLoadList** | GET `/api/backoffice/content/pages` (+ optional create forside); hook runs, same URL/response handling. |
| **page / setPage** | Current page; hook owns. |
| **detailLoading / detailError / pageNotFound / refetchDetailKey** | Detail fetch state; hook owns. |
| **loadPage** | GET `/api/backoffice/content/pages/:id`; hook runs, parses envelope/body, then calls onPageLoaded; same URLs/semantics. |
| **updateSidebarItem** | Updates items by id; hook exposes (uses setItems). |
| **Reset when !selectedId** | Hook sets page=null, detailError=null, pageNotFound=false; calls onReset() so ContentWorkspace clears editor/save state. |
| **Abort/cancel** | Same `active` flag pattern in list and detail effects. |

## B. Stays in ContentWorkspace (single source of truth / callbacks)

| Item | Why it stays |
|------|--------------|
| **selectedId** | From props (initialPageId); URL/router truth. ContentWorkspace passes to hook. |
| **query / queryInput** | Query state; list filter. ContentWorkspace keeps query, passes query to hook. |
| **onPageLoaded** | Callback from hook: ContentWorkspace applies title, slug, documentTypeAlias, envelopeFields, applyParsedBody, setSavedSnapshot, setLastServerUpdatedAt, setSaveStateSafe, setLastError, skipNextAutosaveSchedule, outbox logic (readOutbox, clearOutbox, setOutboxData, setRecoveryBannerVisible). |
| **onReset** | Callback when !selectedId: ContentWorkspace clears title, slug, bodyMode, blocks, meta, legacyBodyText, invalidBodyRaw, bodyParseError, expandedBlockId, detailError, pageNotFound, lastError, lastSavedAt, lastServerUpdatedAt, saveState, savedSnapshot, outboxData, recoveryBannerVisible. |
| **onPageError** | Callback when detail load fails: ContentWorkspace clears savedSnapshot, outboxData, recoveryBannerVisible; optional logEditorAiEvent (ContentWorkspace keeps). |
| **setRefetchDetailKey** | Trigger for refetch; hook exposes setRefetchDetailKey; ContentWorkspace calls it from onReloadFromServer. |
| **setListReloadKey** | Trigger for list refresh; hook exposes setListReloadKey; ContentWorkspace calls it after create page. |
| **effectiveId** | page?.id ?? selectedId; computed in ContentWorkspace from hook’s page + selectedId. |
| **Router / guardedPush / onSelectPage** | ContentWorkspace; not moved. |

## C. Extraction boundary

- **Hook:** useContentWorkspacePageData({ selectedId, query, onPageLoaded, onReset, onPageError })
- **Returns:** items, setItems, listLoading, listError, listReloadKey, setListReloadKey, page, setPage, detailLoading, detailError, pageNotFound, refetchDetailKey, setRefetchDetailKey, updateSidebarItem
- **Behavior:** Identical fetch URLs, response handling, list sort (forside first), create-forside-if-missing, 404/error semantics, reset semantics. Hook does not own block model, save, AI, or router.
