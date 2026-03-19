# ContentWorkspace — Save / Outbox / Recovery Cluster Map (Step 0)

## 1. VERIFIED safe-to-extract responsibilities

| Item | Location | Verification |
|------|----------|--------------|
| **Save/outbox/recovery state and logic** | Already in `useContentWorkspaceSave.ts`: saveState, setSaveStateSafe, lastSavedAt, lastError, savedSnapshot, lastServerUpdatedAt, outboxData, recoveryBannerVisible, dirty, autosave timer, outbox write effect, performSave, patchPage, saveDraft, onRestoreOutbox, onDiscardOutbox, buildOutboxExportSnapshot, copyOutboxSafetyExport. | VERIFIED |
| **Load-success save-state application** | Currently in ContentWorkspace `pageLoadedRef.current`: setLastServerUpdatedAt, setSaveStateSafe("idle"), setLastError(null), setSavedSnapshot(makeSnapshot(...)), skipNextAutosaveSchedule(), and outbox reconciliation (readOutbox, looksMojibakeAny, clearOutbox, setOutboxData, setRecoveryBannerVisible). Logic is purely save/outbox; can move into save hook as `applyLoadSuccess(payload)`. | VERIFIED |
| **Reset save-state clearing** | Currently in ContentWorkspace `resetRef.current`: setLastError(null), setLastSavedAt(null), setLastServerUpdatedAt(null), setSaveStateSafe("idle"), setSavedSnapshot(null), setOutboxData(null), setRecoveryBannerVisible(false). Can move into save hook as `clearSaveStateForReset()`. | VERIFIED |
| **Load-error save-state clearing** | Currently in ContentWorkspace `pageErrorRef.current`: setSavedSnapshot(null), setOutboxData(null), setRecoveryBannerVisible(false). Can move into save hook as `clearSaveStateOnLoadError()`. | VERIFIED |
| **Load-start save-state clearing** | Currently in ContentWorkspace `detailLoadStartRef.current`: setLastError(null), setLastSavedAt(null). Can move into save hook as `clearSaveStateOnLoadStart()`. | VERIFIED |

## 2. VERIFIED responsibilities that must stay in ContentWorkspace

| Item | Reason |
|------|--------|
| **page / setPage** | Single source of truth; save hook receives them as deps. | VERIFIED |
| **title, slug, blocks, meta, setTitle, setSlug, applyParsedBody** | Editor ownership; save hook receives current values and callbacks. | VERIFIED |
| **Editor apply on load success** | setDocumentTypeAlias, setEnvelopeFields, setTitle, setSlug, setSlugTouched, applyParsedBody — must run in ContentWorkspace before calling save hook’s applyLoadSuccess. | VERIFIED |
| **Editor reset on !selectedId** | setBodyMode, setBlocks, setMeta, setLegacyBodyText, etc. — editor reset; save hook only clears save state via clearSaveStateForReset(). | VERIFIED |
| **logEditorAiEvent on load error** | AI/metrics; called in ContentWorkspace after clearSaveStateOnLoadError(). | VERIFIED |
| **outboxDetailsExpanded / setOutboxDetailsExpanded** | UI state for panel; ContentWorkspace keeps it; onDiscardOutbox wrapper calls setOutboxDetailsExpanded(false). | VERIFIED |
| **outboxCopyFeedback / setOutboxCopyFeedback** | UI state; passed to save hook as dep. | VERIFIED |

## 3. Dependencies

| Consumer | Deps |
|----------|------|
| **Save hook** | page, setPage, selectedId, effectiveId, title, slug, bodyForSave, isOffline, pageNotFound, detailError, detailLoading, pageStatus, setTitle, setSlug, setSlugTouched, applyParsedBody, updateSidebarItem, setOutboxCopyFeedback. Uses makeSnapshot, readOutbox, clearOutbox, fingerprintDraft, looksMojibakeAny (to be added). | VERIFIED |
| **ContentWorkspace refs** | After this extraction: pageLoadedRef calls editor apply then saveApi.applyLoadSuccess(data); resetRef calls editor reset then saveApi.clearSaveStateForReset(); pageErrorRef calls saveApi.clearSaveStateOnLoadError() then optional logEditorAiEvent; detailLoadStartRef calls saveApi.clearSaveStateOnLoadStart(). | VERIFIED |
| **Page-data hook** | No change; still calls onPageLoaded, onReset, onPageError, onDetailLoadStart. | VERIFIED |
| **Navigation hook** | No change. guardedPush uses dirty, clearAutosaveTimer from save hook. | VERIFIED |

## 4. Exact candidates to move into save hook

- **applyLoadSuccess(payload)** — payload: { page, nextTitle, nextSlug, snapshotBody, updated_at }. Sets lastServerUpdatedAt, setSaveStateSafe("idle"), setLastError(null), setSavedSnapshot(makeSnapshot(...)), skipNextAutosaveSchedule(), runs outbox reconciliation (readOutbox(page.id), looksMojibakeAny, clearOutbox, setOutboxData, setRecoveryBannerVisible). | VERIFIED
- **clearSaveStateForReset()** — setLastError(null), setLastSavedAt(null), setLastServerUpdatedAt(null), setSaveStateSafe("idle"), setSavedSnapshot(null), setOutboxData(null), setRecoveryBannerVisible(false). | VERIFIED
- **clearSaveStateOnLoadError()** — setSavedSnapshot(null), setOutboxData(null), setRecoveryBannerVisible(false). | VERIFIED
- **clearSaveStateOnLoadStart()** — setLastError(null), setLastSavedAt(null). | VERIFIED

## 5. Exact items that remain in ContentWorkspace

- page, setPage, title, slug, blocks, meta, editor setters.
- pageLoadedRef: editor apply (setDocumentTypeAlias, setEnvelopeFields, setTitle, setSlug, setSlugTouched, applyParsedBody) then saveApi.applyLoadSuccess(data).
- resetRef: editor reset (setTitle, setSlug, setBodyMode, setBlocks, setMeta, …) then saveApi.clearSaveStateForReset().
- pageErrorRef: saveApi.clearSaveStateOnLoadError() then logEditorAiEvent if payload.message.
- detailLoadStartRef: saveApi.clearSaveStateOnLoadStart().
- onDiscardOutbox wrapper (onDiscardOutboxFromSave + setOutboxDetailsExpanded(false)).
- All AI, publish, preview, page-data, navigation composition.

## 6. Risks and coupling notes

- **applyLoadSuccess** uses same outbox reconciliation logic as today; hook already has readOutbox, clearOutbox, fingerprintDraft; add looksMojibakeAny from contentWorkspace.helpers. | VERIFIED
- **Payload type:** Save hook defines a minimal LoadSuccessPayload type (page with id/title/slug/status/updated_at, nextTitle, nextSlug, snapshotBody, updated_at) to avoid importing from page-data hook. ContentWorkspace passes PageLoadedData which satisfies it. | VERIFIED
