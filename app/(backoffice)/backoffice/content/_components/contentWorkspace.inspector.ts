/**
 * Canonical construction of BlockInspectorFieldsCtx for the CMS workspace.
 * Keeps inspector wiring out of ContentWorkspace.tsx; does not change preview/render pipelines.
 */

import type { BlockInspectorFieldsCtx } from "./BlockInspectorFields";

/** Rich-text + CMS image AI slice — built in one place to keep `ContentWorkspace` useMemos shallow. */
export type BlockInspectorRichTextSlice = Pick<
  BlockInspectorFieldsCtx,
  | "richTextDirectAiBusy"
  | "richTextInline"
  | "setRichTextInline"
  | "inlineAbortRef"
  | "inlineBodyRunRef"
  | "inlineBodyDebounceRef"
  | "fetchRichTextInlineBody"
  | "runRichTextContinueAtCursor"
  | "runRichTextRewriteSelection"
  | "richTextInlineRef"
  | "cmsAiImagePromptByBlockId"
  | "setCmsAiImagePromptByBlockId"
  | "cmsAiImageBusyBlockId"
  | "onCmsAiGenerateImageForBlock"
>;

export function buildBlockInspectorRichTextSlice(slice: BlockInspectorRichTextSlice): BlockInspectorRichTextSlice {
  return slice;
}

/** Non–rich-text inspector inputs (shell hands these off; rich slice stays separate). */
export type BlockInspectorWorkspaceBase = Pick<
  BlockInspectorFieldsCtx,
  | "setBlockById"
  | "setMediaPickerTarget"
  | "setMediaPickerOpen"
  | "isOffline"
  | "effectiveId"
  | "aiBusyToolId"
  | "handleAiStructuredIntent"
>;

/** Single adapter: base workspace props + rich-text/image AI slice → full inspector ctx. */
export function buildBlockInspectorWorkspaceCtx(
  base: BlockInspectorWorkspaceBase,
  rich: BlockInspectorRichTextSlice
): BlockInspectorFieldsCtx {
  return buildBlockInspectorFieldsCtx({ ...base, ...rich });
}

/** Én flat input: editor/base + rich-text slice — mindre kobling i `ContentWorkspace.tsx`. */
export type BlockInspectorWorkspaceShellInput = BlockInspectorWorkspaceBase & {
  richText: BlockInspectorRichTextSlice;
};

export function buildBlockInspectorWorkspaceCtxFromShell(
  input: BlockInspectorWorkspaceShellInput
): BlockInspectorFieldsCtx {
  const { richText, ...base } = input;
  return buildBlockInspectorWorkspaceCtx(base, buildBlockInspectorRichTextSlice(richText));
}

/** Same shape as BlockInspectorFieldsCtx — explicit pass-through documents the contract. */
export function buildBlockInspectorFieldsCtx(input: BlockInspectorFieldsCtx): BlockInspectorFieldsCtx {
  return {
    setBlockById: input.setBlockById,
    setMediaPickerTarget: input.setMediaPickerTarget,
    setMediaPickerOpen: input.setMediaPickerOpen,
    isOffline: input.isOffline,
    effectiveId: input.effectiveId,
    aiBusyToolId: input.aiBusyToolId,
    handleAiStructuredIntent: input.handleAiStructuredIntent,
    richTextDirectAiBusy: input.richTextDirectAiBusy,
    richTextInline: input.richTextInline,
    setRichTextInline: input.setRichTextInline,
    inlineAbortRef: input.inlineAbortRef,
    inlineBodyRunRef: input.inlineBodyRunRef,
    inlineBodyDebounceRef: input.inlineBodyDebounceRef,
    fetchRichTextInlineBody: input.fetchRichTextInlineBody,
    runRichTextContinueAtCursor: input.runRichTextContinueAtCursor,
    runRichTextRewriteSelection: input.runRichTextRewriteSelection,
    richTextInlineRef: input.richTextInlineRef,
    cmsAiImagePromptByBlockId: input.cmsAiImagePromptByBlockId,
    setCmsAiImagePromptByBlockId: input.setCmsAiImagePromptByBlockId,
    cmsAiImageBusyBlockId: input.cmsAiImageBusyBlockId,
    onCmsAiGenerateImageForBlock: input.onCmsAiGenerateImageForBlock,
  };
}
