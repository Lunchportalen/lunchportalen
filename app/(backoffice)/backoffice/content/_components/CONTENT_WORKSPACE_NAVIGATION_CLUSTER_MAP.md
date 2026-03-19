# ContentWorkspace — Selection / Navigation Cluster Map (Step 0)

## 1. VERIFIED safe-to-extract responsibilities

| Item | Location / behavior | Verification |
|------|---------------------|--------------|
| **queryInput / setQueryInput** | State for sidebar search input; no dependency on editor/save/outbox. | VERIFIED: only used in search input and passed to debounce. |
| **query / setQuery** | Debounced value fed to `useContentWorkspacePageData`; list fetch uses it. | VERIFIED: derived from queryInput; no editor/save coupling. |
| **Debounce effect** | `useEffect` 180ms: `setQuery(safeStr(queryInput))`. | VERIFIED: pure timing + string normalization. |
| **mainView / setMainView** | `"page" \| "global" \| "design"`; which shell tab is active. | VERIFIED: UI-only; no editor/save mutation. |
| **hjemExpanded / setHjemExpanded** | Sidebar “Hjem” section expanded/collapsed. | VERIFIED: UI-only. |
| **onSelectPage** | Sets mainView to "page", checks isSamePage, then calls navigate to `/backoffice/content/${nextId}`. | VERIFIED: logic is selection + navigate; navigate must be injected (guardedPush) because it depends on dirty/clearAutosaveTimer. |

## 2. VERIFIED responsibilities that must stay in ContentWorkspace

| Item | Reason |
|------|--------|
| **selectedId** | Derived from props: `safeStr(initialPageId)`. URL/route truth; passed to page-data hook and many consumers. Kept as derivation in ContentWorkspace; passed into nav hook as input. | VERIFIED |
| **guardedPush** | Uses `dirty`, `clearAutosaveTimer`, `router` (save coupling). Cannot move without pulling save concerns into the hook. | VERIFIED |
| **page / setPage** | Locked single source of truth for saveApi. | VERIFIED |
| **navigate ref assignment** | ContentWorkspace sets `navigateRef.current = guardedPush` after guardedPush is created so the hook can call it without depending on save. | VERIFIED |
| **Create-page follow-up** | `setListReloadKey`, `guardedPush(nextId)` after create; create panel state. Not part of “selection” cluster; stays in ContentWorkspace. | VERIFIED |
| **onReloadFromServer** | Calls `setRefetchDetailKey` (from pageData) and `clearAutosaveTimer`; mixed with save. Stays. | VERIFIED |
| **hjemSingleClickTimerRef** | Used for Hjem single vs double click; only affects when onSelectPage is called. Could move to hook in a later step; left in ContentWorkspace to keep this patch minimal. | INFERRED |

## 3. Dependencies

| Consumer | Deps |
|----------|------|
| **page-data hook** | Needs `selectedId`, `query`. So `query` must be provided before or by the same component that calls pageData. Nav hook can own query and be called first. | VERIFIED |
| **guardedPush** | Depends on `dirty`, `clearAutosaveTimer`, `router`. Built after saveApi. Nav hook receives a ref that ContentWorkspace sets to guardedPush. | VERIFIED |
| **onSelectPage** | Needs `selectedId`, `page?.id` (for isSamePage), and navigate. Hook receives selectedId, pageId, navigateRef. | VERIFIED |

## 4. Exact candidates to move

- State: `queryInput`, `setQueryInput`, `query`, `setQuery`, `mainView`, `setMainView`, `hjemExpanded`, `setHjemExpanded`.
- Effect: debounce 180ms from queryInput to query.
- Callback: `onSelectPage(nextId, _slug?)` implemented in the hook using injected `navigateRef` and `setMainView`.

## 5. Exact items that remain

- `selectedId = safeStr(initialPageId)` (in ContentWorkspace).
- `guardedPush` (in ContentWorkspace).
- `page`, `setPage` (in ContentWorkspace).
- `hjemSingleClickTimerRef` (in ContentWorkspace).
- Create flow, onReloadFromServer, all save/outbox/editor/AI logic.

## 6. Risk notes

- **Navigate ref:** Hook uses a ref for navigate so it can be called before guardedPush exists and so query is available for pageData. Ref is assigned in ContentWorkspace after guardedPush is created. Low risk. | VERIFIED
- **No filtered list:** Filtering is server-side via `query`; no client-side `filteredItems`. Nav hook only owns queryInput/query and debounce. | VERIFIED
