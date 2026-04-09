"use client";

import { useMemo } from "react";
import type { BlockInspectorFieldsCtx } from "./BlockInspectorFields";
import {
  buildBlockInspectorWorkspaceCtxFromShell,
  type BlockInspectorWorkspaceShellInput,
} from "./contentWorkspace.inspector";

/**
 * Én hook for inspector-ctx — skallet lister bare felt; `useMemo`+deps ligger her.
 */
export function useBlockInspectorWorkspaceCtxFromShell(
  input: BlockInspectorWorkspaceShellInput
): BlockInspectorFieldsCtx {
  const {
    setBlockById,
    setMediaPickerTarget,
    setMediaPickerOpen,
    isOffline,
    effectiveId,
    aiBusyToolId,
    handleAiStructuredIntent,
    richText,
  } = input;

  /* Granular `richText.*` deps — same contract as pre–FASE 13 shell; object identity would over-invalidate. */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- richText fields listed explicitly above
  return useMemo(
    () =>
      buildBlockInspectorWorkspaceCtxFromShell({
        setBlockById,
        setMediaPickerTarget,
        setMediaPickerOpen,
        isOffline,
        effectiveId,
        aiBusyToolId,
        handleAiStructuredIntent,
        richText,
      }),
    [
      setBlockById,
      setMediaPickerTarget,
      setMediaPickerOpen,
      isOffline,
      effectiveId,
      aiBusyToolId,
      handleAiStructuredIntent,
      richText.richTextDirectAiBusy,
      richText.richTextInline,
      richText.fetchRichTextInlineBody,
      richText.runRichTextContinueAtCursor,
      richText.runRichTextRewriteSelection,
      richText.cmsAiImagePromptByBlockId,
      richText.cmsAiImageBusyBlockId,
      richText.onCmsAiGenerateImageForBlock,
      richText.inlineAbortRef,
      richText.inlineBodyRunRef,
      richText.inlineBodyDebounceRef,
      richText.richTextInlineRef,
      richText.setRichTextInline,
    ]
  );
}
