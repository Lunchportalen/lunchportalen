"use client";

/**
 * Workspace-modaler samlet — ingen ny forretningslogikk; callbacks kommer fra skallet.
 */

import type { BackofficeBlockDefinition } from "@/lib/cms/backofficeBlockCatalog";
import { BlockLibrary } from "./BlockLibrary";
import { BlockEditModal } from "./BlockEditModal";
import { ContentWorkspaceAiFullPageModal } from "./ContentWorkspaceAiFullPageModal";
import { MediaPickerModal } from "./MediaPickerModal";
import type { EditableBlock } from "./BlockEditModal";
import type { Block } from "./editorBlockTypes";
import type { ContentPage } from "./ContentWorkspaceState";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";

export type ContentWorkspaceModalStackProps = {
  fullPageAi: {
    open: boolean;
    onClose: () => void;
    prompt: string;
    onPromptChange: (v: string) => void;
    busy: boolean;
    error: string | null;
    preview: { title: string; blocksRaw: unknown[] } | null;
    previewBlocks: Block[];
    replaceOk: boolean;
    onReplaceOkChange: (v: boolean) => void;
    alsoTitle: boolean;
    onAlsoTitleChange: (v: boolean) => void;
    onGenerate: () => void | Promise<void>;
    onApply: () => void;
  };
  blockPicker: {
    open: boolean;
    page: ContentPage | null;
    slug: string;
    title: string;
    isForside: (slug: string, title: string) => boolean;
    onClose: () => void;
    onPick: (def: BackofficeBlockDefinition) => void;
    allowedBlockTypeKeys?: string[] | null;
    blockEditorDataTypeAlias?: string | null;
    /** U95 — merged definisjon for bibliotek-grupper (samme som canvas). */
    blockEditorDataTypeEffective?: BlockEditorDataTypeDefinition | null;
    /** U94B — samme create-label som canvas (data type createButtonLabel). */
    blockListCreateLabel?: string | null;
    blockCount?: number;
    blockMaxItems?: number | null;
  };
  blockEdit: {
    open: boolean;
    block: Block | null;
    blockIndex: number | null;
    onClose: () => void;
    onLiveDraftChange: (b: EditableBlock | null) => void;
    onChange: (nextBlock: EditableBlock) => void;
    onDelete: () => void;
  };
  mediaPicker: {
    open: boolean;
    hasTarget: boolean;
    title: string;
    onClose: () => void;
    onSelect: (picked: string | { url: string; id?: string }) => void;
  };
};

export function ContentWorkspaceModalStack(props: ContentWorkspaceModalStackProps) {
  const { fullPageAi, blockPicker, blockEdit, mediaPicker } = props;

  return (
    <>
      <ContentWorkspaceAiFullPageModal
        open={fullPageAi.open}
        onClose={fullPageAi.onClose}
        prompt={fullPageAi.prompt}
        onPromptChange={fullPageAi.onPromptChange}
        busy={fullPageAi.busy}
        error={fullPageAi.error}
        preview={fullPageAi.preview}
        previewBlocks={fullPageAi.previewBlocks}
        replaceOk={fullPageAi.replaceOk}
        onReplaceOkChange={fullPageAi.onReplaceOkChange}
        alsoTitle={fullPageAi.alsoTitle}
        onAlsoTitleChange={fullPageAi.onAlsoTitleChange}
        onGenerate={fullPageAi.onGenerate}
        onApply={fullPageAi.onApply}
      />

      <BlockLibrary
        open={blockPicker.open}
        context={{
          pageId: blockPicker.page?.id ?? "unknown",
          isHome:
            (blockPicker.page ? blockPicker.isForside(blockPicker.page.slug, blockPicker.page.title) : blockPicker.isForside(blockPicker.slug, blockPicker.title)) ||
            blockPicker.page?.slug === "home" ||
            blockPicker.page?.id === "home",
          docType: null,
          allowedBlockTypeKeys: blockPicker.allowedBlockTypeKeys,
          blockEditorDataTypeAlias: blockPicker.blockEditorDataTypeAlias ?? null,
          blockEditorDataTypeEffective: blockPicker.blockEditorDataTypeEffective ?? null,
          blockListCreateLabel: blockPicker.blockListCreateLabel ?? null,
          blockCount: blockPicker.blockCount,
          blockMaxItems: blockPicker.blockMaxItems ?? null,
        }}
        onClose={blockPicker.onClose}
        onPick={blockPicker.onPick}
      />

      <BlockEditModal
        open={blockEdit.open}
        block={blockEdit.block}
        blockIndex={blockEdit.blockIndex}
        onClose={blockEdit.onClose}
        onLiveDraftChange={blockEdit.onLiveDraftChange}
        onChange={blockEdit.onChange}
        onDelete={blockEdit.onDelete}
      />

      <MediaPickerModal
        open={mediaPicker.open && mediaPicker.hasTarget}
        title={mediaPicker.title}
        onClose={mediaPicker.onClose}
        onSelect={mediaPicker.onSelect}
      />
    </>
  );
}
