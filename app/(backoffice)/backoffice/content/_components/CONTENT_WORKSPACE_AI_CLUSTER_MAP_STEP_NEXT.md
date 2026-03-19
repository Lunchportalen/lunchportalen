# ContentWorkspace — AI Action / Orchestration Cluster Map (Step Next)

## 1. VERIFIED safe-to-extract responsibilities

| Item | Purpose | Verification |
|------|--------|---------------|
| **AI state (orchestration only)** | aiBusyToolId, aiError, aiSummary, aiBlockBuilderResult, aiPageBuilderResult, aiScreenshotBuilderResult, lastGeneratedImageResult, aiLastAppliedTool, aiLastActionFeature, diagnosticsResult, diagnosticsBusy, aiHistory. Used for request lifecycle and UI; not editor content ownership. | VERIFIED |
| **aiCapability + fetch effect** | Loading/available/unavailable for AI; fetch /api/backoffice/ai/capability when selectedId changes. | VERIFIED |
| **reportAiError** | setAiError + logEditorAiEvent; no editor mutation. | VERIFIED |
| **pushAiHistory** | Append to aiHistory slice; no editor mutation. | VERIFIED |
| **callAiSuggest** | Build body (buildAiBlocks, buildAiMeta, etc.), POST /api/backoffice/ai/suggest, normalize errors, extract summary, apply patch via callback. Patch application can be delegated to ContentWorkspace via onApplySuggestPatch(editorBlocks, mergedMeta). | VERIFIED |
| **callDedicatedAiRoute** | POST to given path, set result state (block/screenshot/image), getSummary; no editor mutation inside. | VERIFIED |
| **runFullDiagnostics** | callAiSuggest(improve) then callAiSuggest(seo), setDiagnosticsResult, setMeta(mergeContractIntoMeta); hook can own state and call onMergeDiagnosticsMeta(merged). | VERIFIED |
| **Trigger handlers** | handleAiImprovePage, handleAiSeoOptimize, handleAiGenerateSections, handleAiStructuredIntent, handleAiImageGenerate, handleAiImageImproveMetadata, handleLayoutSuggestions, handleBlockBuilder, handleScreenshotBuilder — each logs and calls callAiSuggest/callDedicatedAiRoute. Hook can own them if it receives blocks, meta, title, slug, effectiveId and has callAiSuggest/callDedicatedAiRoute. | VERIFIED |
| **handlePageBuilder (request)** | Inline fetch to /api/backoffice/ai/page-builder; sets aiPageBuilderResult. Can live in hook. | VERIFIED |

## 2. VERIFIED responsibilities that must stay in ContentWorkspace

| Item | Reason |
|------|--------|
| **Editor values** | blocks, meta, title, slug, setTitle, setSlug, setBlocks, setMeta, applyParsedBody, setBodyMode, setExpandedBlockId — owned by ContentWorkspace; passed to hook as inputs or callbacks. | VERIFIED |
| **onApplySuggestPatch** | ContentWorkspace implements: applyParsedBody(parseBodyToBlocks({ blocks: editorBlocks, meta: mergedMeta })). Hook calls this after applyAIPatchV1 and meta merge. | VERIFIED |
| **handleBlockBuilderInsert** | Uses setBodyMode, setBlocks, setExpandedBlockId, addInsertIndexRef; mutates editor. | VERIFIED |
| **handleScreenshotBuilderReplace / Append** | Uses applyParsedBody or setBlocks, setBodyMode, confirm; mutates editor. | VERIFIED |
| **handlePageBuilderReplace / Append** | Uses applyParsedBody or setBlocks, setBodyMode; mutates editor. | VERIFIED |
| **screenshotResultToEditorBlocks, pageBuilderResultToEditorBlocks** | Use normalizeBlock, normalizePageBuilderBlocks; used by apply handlers. Can stay in ContentWorkspace or move to shared module; they are pure given result shape. | INFERRED |
| **handleHeroImageSuggestions, applyHeroImageSuggestion** | Use setHeroImageSuggestions, setBlockById; hero image UI and block mutation. | VERIFIED |
| **handleFetchImageAltFromArchive** | Fetches media API; logs via logEditorAiEvent; returns result. Stays in ContentWorkspace. | VERIFIED |
| **editor_opened effect** | Logs once per effectiveId; can stay in ContentWorkspace (or move to hook as lifecycle). | INFERRED |

## 3. Dependencies

| Consumer | Deps |
|----------|------|
| **callAiSuggest** | effectiveId, blocks, meta, title, slug (inputs); buildAiBlocks, buildAiMeta, buildAiExistingBlocks (contentWorkspace.ai); extractAiSummary (helpers); applyAIPatchV1, isAIPatchV1 (lib); mergeContractIntoMeta, appendDiagnosticsSuggestion; applyParsedBody via onApplySuggestPatch; setAiSummary, setAiLastAppliedTool, pushAiHistory, reportAiError, logEditorAiEvent. | VERIFIED |
| **callDedicatedAiRoute** | setAiBlockBuilderResult, setAiScreenshotBuilderResult, setLastGeneratedImageResult, setAiSummary, pushAiHistory, reportAiError, logEditorAiEvent (builder_warning). | VERIFIED |
| **runFullDiagnostics** | meta (parseMetaToPageAiContract), callAiSuggest x2, setDiagnosticsResult, setMeta(mergeContractIntoMeta), pushAiHistory. | VERIFIED |
| **Handlers** | effectiveId, blocks, meta, title, slug, parseMetaToPageAiContract, logEditorAiEvent, setAiLastActionFeature, callAiSuggest, callDedicatedAiRoute. | VERIFIED |

## 4. Exact candidates to move into useContentWorkspaceAi

- All AI state listed in §1.
- reportAiError, pushAiHistory.
- callAiSuggest (with onApplySuggestPatch(editorBlocks, mergedMeta) from ContentWorkspace).
- callDedicatedAiRoute.
- runFullDiagnostics (with onMergeDiagnosticsMeta(merged) or setMeta passed in).
- handleAiImprovePage, handleAiSeoOptimize, handleAiGenerateSections, handleAiStructuredIntent, handleAiImageGenerate, handleAiImageImproveMetadata, handleLayoutSuggestions, handleBlockBuilder, handleScreenshotBuilder (request only), handlePageBuilder (request only).
- AI capability effect (fetch /api/backoffice/ai/capability). | VERIFIED

## 5. Exact items that remain in ContentWorkspace

- Editor state and setters; page/setPage.
- onApplySuggestPatch callback (calls applyParsedBody).
- setMeta callback for runFullDiagnostics merge.
- handleBlockBuilderInsert, handleScreenshotBuilderReplace, handleScreenshotBuilderAppend, handlePageBuilderReplace, handlePageBuilderAppend.
- screenshotResultToEditorBlocks, pageBuilderResultToEditorBlocks (or move to contentWorkspace.ai / blocks).
- handleHeroImageSuggestions, applyHeroImageSuggestion, heroImageSuggestions state.
- handleFetchImageAltFromArchive.
- editor_opened effect (optional: move to hook). | VERIFIED

## 6. Post-extraction note (handleBannerVisualOptions)

After extraction, `handleBannerVisualOptions` was restored in ContentWorkspace with a minimal implementation: it sets `bannerVisualOptions` to `{ targetBlockId, targetItemId: item.id, options: [], error: null }` so the banner UI does not break. Any original fetch/API for visual options was in the removed block and can be re-added in ContentWorkspace if needed. | VERIFIED

## 7. Risks and coupling notes

- **Patch application:** callAiSuggest applies AIPatchV1 and then must call applyParsedBody with merged meta. Hook will compute editorBlocks and mergedMeta and call onApplySuggestPatch(editorBlocks, mergedMeta); ContentWorkspace implements it with parseBodyToBlocks + applyParsedBody. applyAIPatchV1 and merge logic can stay in hook (they take payload + current blocks/meta and return applied; no setState). | VERIFIED
- **Normalizers:** screenshotResultToEditorBlocks and pageBuilderResultToEditorBlocks use normalizeBlock from contentWorkspace.blocks and normalizePageBuilderBlocks. Apply handlers in ContentWorkspace need them; they can remain in ContentWorkspace. | VERIFIED
- **handlePageBuilder:** Currently inline fetch in ContentWorkspace; moves into hook and sets aiPageBuilderResult. Same URL and payload. | VERIFIED
