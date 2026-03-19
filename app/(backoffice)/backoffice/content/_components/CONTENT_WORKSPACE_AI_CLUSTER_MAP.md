# ContentWorkspace — VERIFIED AI cluster map (Step 0)

## A. Safe-to-extract orchestration

| Item | Purpose | Dependencies |
|------|--------|--------------|
| **AI_TOOL_TO_FEATURE** | Map tool id → EditorAiFeature for metrics/errors | EditorAiFeature type |
| **buildAiBlocks(blocks)** | Map Block[] → API shape { id, type, data? }[] | Block type |
| **buildAiExistingBlocks(blocks)** | Map blocks → { id, type }[] | none |
| **buildAiMeta(meta)** | Page AI contract → { description?, title? } for suggest | parseMetaToPageAiContract, contractToAiMetaShape |
| **rankHeroMediaSuggestions(context, items)** | Score/filter hero image suggestions by context tokens | HeroSuggestion type |
| **normalizeAiApiError(res, json)** | Shared error message for !res.ok or 503/FEATURE_DISABLED | none (pure) |

- **extractAiSummary** already lives in contentWorkspace.helpers.ts.
- Request body shape for suggest is fixed; builders are pure given blocks/meta.

## B. Editor-state-dependent (remain in ContentWorkspace)

| Item | Why it stays |
|------|--------------|
| **callAiSuggest** | Sets aiBusyToolId, aiError, aiSummary, aiLastAppliedTool; calls applyParsedBody when patch present; uses blocks, meta, title, slug, effectiveId; calls reportAiError, pushAiHistory, logEditorAiEvent. Apply branch mutates editor via applyParsedBody. |
| **callDedicatedAiRoute** | Sets aiBusyToolId, aiError, aiSummary, aiBlockBuilderResult, aiScreenshotBuilderResult, lastGeneratedImageResult; calls pushAiHistory for image generator; uses setAi* state. |
| **reportAiError** | useCallback that setAiError + logEditorAiEvent; depends on effectiveId. |
| **All handleAi* handlers** | Thin wrappers that build input and call callAiSuggest/callDedicatedAiRoute; some use parseMetaToPageAiContract(meta), setAiLastActionFeature, logEditorAiEvent. |
| **runFullDiagnostics** | Calls callAiSuggest twice, setDiagnosticsResult, setMeta(mergeContractIntoMeta). |
| **handleBlockBuilderInsert, handleScreenshotBuilderReplace/Append, handlePageBuilderReplace/Append** | Mutate blocks/meta via setBlocks, applyParsedBody; use setBodyMode, setExpandedBlockId, setAi*, pushAiHistory, reportAiError. |
| **screenshotResultToEditorBlocks, pageBuilderResultToEditorBlocks** | Pure normalizers; could move to ai module but they use normalizeBlock from blocks and pageBuilderNormalize. |
| **AI state** (aiBusyToolId, aiError, aiSummary, aiBlockBuilderResult, aiPageBuilderResult, aiScreenshotBuilderResult, lastGeneratedImageResult, aiLastAppliedTool, aiLastActionFeature, aiCapability, diagnosticsResult, diagnosticsBusy, aiHistory) | Owned in ContentWorkspace; UI and handlers depend on it. |
| **editor_opened / AI capability / media health effects** | Run in ContentWorkspace; depend on effectiveId/selectedId. |

## C. Extraction boundary

- **Extract:** AI_TOOL_TO_FEATURE, buildAiBlocks, buildAiExistingBlocks, buildAiMeta, rankHeroMediaSuggestions, normalizeAiApiError into `contentWorkspace.ai.ts`.
- **Keep in ContentWorkspace:** callAiSuggest, callDedicatedAiRoute, reportAiError, all handlers, all AI state, apply-patch logic (applyAIPatchV1 + applyParsedBody), metrics calls (logEditorAiEvent), diagnostics and history updates.
- **Result:** ContentWorkspace imports builders and normalizeAiApiError from contentWorkspace.ai.ts and uses them inside callAiSuggest/callDedicatedAiRoute; no change to payload shapes, routes, or apply semantics.
