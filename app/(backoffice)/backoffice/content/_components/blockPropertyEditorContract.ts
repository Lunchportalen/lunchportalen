import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Block } from "./editorBlockTypes";

export type RichTextInlineState = { blockId: string | null; suffix: string };

/**
 * Shell context for block property editors — same pipeline as legacy BlockInspectorFields (setBlockById, AI, media).
 * Dirty/save remains owned by workspace blocks state; editors only commit via setBlockById.
 */
export type BlockInspectorFieldsCtx = {
  setBlockById: (id: string, updater: (current: Block) => Block) => void;
  setMediaPickerTarget: Dispatch<
    SetStateAction<{
      blockId: string;
      itemId?: string;
      field: "imageUrl" | "videoUrl" | "heroImageUrl" | "heroBleedBackground" | "heroBleedOverlay";
    } | null>
  >;
  setMediaPickerOpen: Dispatch<SetStateAction<boolean>>;
  isOffline: boolean;
  effectiveId: string | null | undefined;
  aiBusyToolId: string | null;
  handleAiStructuredIntent?: (
    payload: { variantCount: number; target: string },
    meta: { fromPanel: boolean },
  ) => void;
  richTextDirectAiBusy: { blockId: string; op: string } | null | undefined;
  richTextInline: RichTextInlineState;
  setRichTextInline: Dispatch<SetStateAction<RichTextInlineState>>;
  inlineAbortRef: MutableRefObject<AbortController | null | undefined>;
  inlineBodyRunRef: MutableRefObject<(() => void) | null>;
  inlineBodyDebounceRef: MutableRefObject<() => void>;
  fetchRichTextInlineBody: (blockId: string, body: string, heading: string) => void | Promise<void>;
  runRichTextContinueAtCursor: (
    blockId: string,
    el: HTMLTextAreaElement,
    body: string,
    heading: string,
  ) => void | Promise<void>;
  runRichTextRewriteSelection: (
    blockId: string,
    el: HTMLTextAreaElement,
    body: string,
    mode: string,
  ) => void | Promise<void>;
  richTextInlineRef: MutableRefObject<RichTextInlineState>;
  cmsAiImagePromptByBlockId: Record<string, string>;
  setCmsAiImagePromptByBlockId: Dispatch<SetStateAction<Record<string, string>>>;
  cmsAiImageBusyBlockId: string | null;
  onCmsAiGenerateImageForBlock: (blockId: string, prompt: string) => void | Promise<void>;
};

/** Alias for callers that must not reference the `BlockInspectorFields` name string (e.g. U80 WorkspaceBody parity). */
export type BlockInspectorWorkspaceCtx = BlockInspectorFieldsCtx;
