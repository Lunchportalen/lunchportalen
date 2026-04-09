/**
 * Ren prop-assembly for ContentWorkspaceModalShell — ingen ny forretningslogikk.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { BackofficeBlockDefinition } from "@/lib/cms/backofficeBlockCatalog";
import { getEffectiveAllowedBlockTypeKeys, isBlockTypeAllowedForDocumentType } from "@/lib/cms/blockAllowlistGovernance";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { canAddBlockForDataType, getBlockEditorDataTypeForDocument } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { EditableBlock } from "./BlockEditModal";
import type { Block, BlockType } from "./editorBlockTypes";
import { createBlock, isAddModalBlockTypeFromOverlay, type BodyMode } from "./contentWorkspace.blocks";
import type { ContentWorkspaceModalShellProps } from "./ContentWorkspaceModalShell";
import type { ContentWorkspaceModalStackProps } from "./ContentWorkspaceModalStack";
import type { ContentPage } from "./ContentWorkspaceState";

export type ContentWorkspaceMediaPickerTarget = {
  blockId: string;
  itemId?: string;
  field: "imageUrl" | "videoUrl" | "heroImageUrl" | "heroBleedBackground" | "heroBleedOverlay";
} | null;

export type BuildContentWorkspaceModalStackPropsArgs = {
  aiFullPageModalOpen: boolean;
  closeAiFullPageModal: () => void;
  aiFullPageModalPrompt: string;
  setAiFullPageModalPrompt: (v: string) => void;
  aiFullPageBusy: boolean;
  aiFullPageError: string | null;
  aiFullPagePreview: { title: string; blocksRaw: unknown[] } | null;
  aiFullPagePreviewBlocks: Block[];
  aiFullPageReplaceOk: boolean;
  setAiFullPageReplaceOk: (v: boolean) => void;
  aiFullPageAlsoTitle: boolean;
  setAiFullPageAlsoTitle: (v: boolean) => void;
  onAiFullPageModalGenerate: () => void | Promise<void>;
  onAiFullPageModalApply: () => void;
  blockPickerOpen: boolean;
  page: ContentPage | null;
  slug: string;
  title: string;
  isForside: (slug: string, title: string) => boolean;
  setBlockPickerOpen: (v: boolean) => void;
  addInsertIndexRef: MutableRefObject<number | null>;
  setBodyMode: (m: BodyMode) => void;
  setBodyParseError: Dispatch<SetStateAction<string | null>>;
  setLegacyBodyText: (v: string) => void;
  setInvalidBodyRaw: (v: string) => void;
  setBlocks: Dispatch<SetStateAction<Block[]>>;
  setSelectedBlockId: (id: string | null) => void;
  editOpen: boolean;
  blocks: Block[];
  editIndex: number | null;
  setEditModalLiveBlock: (b: EditableBlock | null) => void;
  setEditOpen: (v: boolean) => void;
  setEditIndex: (v: number | null) => void;
  onDeleteBlock: (id: string) => void;
  mediaPickerOpen: boolean;
  mediaPickerTarget: ContentWorkspaceMediaPickerTarget;
  setMediaPickerOpen: (v: boolean) => void;
  setMediaPickerTarget: (v: ContentWorkspaceMediaPickerTarget) => void;
  setBlockById: (blockId: string, updater: (block: Block) => Block) => void;
  /** U24 — dokumenttype for block allowlist (null = legacy uten envelope) */
  documentTypeAlias: string | null;
  /** U95 — admin-merged data types fra settings API (null = laster / baseline i resolver) */
  mergedBlockEditorDataTypes: Record<string, BlockEditorDataTypeDefinition> | null;
  /** U96 — admin-merged document types */
  mergedDocumentTypeDefinitions: Record<string, DocumentTypeDefinition> | null;
};

export function buildContentWorkspaceModalStackProps(
  p: BuildContentWorkspaceModalStackPropsArgs
): ContentWorkspaceModalStackProps {
  const allowedBlockTypeKeys = getEffectiveAllowedBlockTypeKeys(
    p.documentTypeAlias,
    p.mergedBlockEditorDataTypes,
    p.mergedDocumentTypeDefinitions,
  );
  const editorDt = getBlockEditorDataTypeForDocument(
    p.documentTypeAlias,
    p.mergedBlockEditorDataTypes,
    p.mergedDocumentTypeDefinitions,
  );
  const blockEditorDataTypeAlias = editorDt?.alias ?? null;
  const blockMaxItems = editorDt?.maxItems ?? null;
  const blockListCreateLabel = editorDt?.createButtonLabel ?? null;
  return {
    fullPageAi: {
      open: p.aiFullPageModalOpen,
      onClose: p.closeAiFullPageModal,
      prompt: p.aiFullPageModalPrompt,
      onPromptChange: p.setAiFullPageModalPrompt,
      busy: p.aiFullPageBusy,
      error: p.aiFullPageError,
      preview: p.aiFullPagePreview,
      previewBlocks: p.aiFullPagePreviewBlocks,
      replaceOk: p.aiFullPageReplaceOk,
      onReplaceOkChange: p.setAiFullPageReplaceOk,
      alsoTitle: p.aiFullPageAlsoTitle,
      onAlsoTitleChange: p.setAiFullPageAlsoTitle,
      onGenerate: p.onAiFullPageModalGenerate,
      onApply: p.onAiFullPageModalApply,
    },
    blockPicker: {
      open: p.blockPickerOpen,
      page: p.page,
      slug: p.slug,
      title: p.title,
      isForside: p.isForside,
      onClose: () => {
        p.setBlockPickerOpen(false);
        p.addInsertIndexRef.current = null;
      },
      allowedBlockTypeKeys,
      blockEditorDataTypeAlias,
      blockEditorDataTypeEffective: editorDt ?? null,
      blockListCreateLabel,
      blockCount: p.blocks.length,
      blockMaxItems,
      onPick: (def: BackofficeBlockDefinition) => {
        const safeType: BlockType = isAddModalBlockTypeFromOverlay(def.type) ? def.type : "richText";
        if (
          !isBlockTypeAllowedForDocumentType(
            p.documentTypeAlias,
            safeType,
            p.mergedBlockEditorDataTypes,
            p.mergedDocumentTypeDefinitions,
          )
        ) {
          return;
        }
        if (
          !canAddBlockForDataType(
            p.documentTypeAlias,
            p.blocks.length,
            p.mergedBlockEditorDataTypes,
            p.mergedDocumentTypeDefinitions,
          )
        ) {
          return;
        }
        const next = createBlock(safeType);

        p.setBodyMode("blocks");
        p.setBodyParseError(null);
        p.setLegacyBodyText("");
        p.setInvalidBodyRaw("");

        p.setBlocks((prev) => {
          const index = p.addInsertIndexRef.current;
          if (index == null || index < 0 || index > prev.length) {
            return [...prev, next];
          }
          const copy = [...prev];
          copy.splice(index, 0, next);
          return copy;
        });
        p.setSelectedBlockId(next.id);
        p.setBlockPickerOpen(false);
        p.addInsertIndexRef.current = null;
      },
    },
    blockEdit: {
      open: p.editOpen,
      block: p.editIndex != null && p.blocks[p.editIndex] ? p.blocks[p.editIndex] : null,
      blockIndex: p.editIndex,
      onClose: () => {
        p.setEditModalLiveBlock(null);
        p.setEditOpen(false);
        p.setEditIndex(null);
      },
      onLiveDraftChange: p.setEditModalLiveBlock,
      onChange: (nextBlock) => {
        if (p.editIndex == null) return;
        p.setBlocks((prev) => prev.map((b, i) => (i === p.editIndex ? (nextBlock as Block) : b)));
      },
      onDelete: () => {
        if (p.editIndex == null) return;
        const id = p.blocks[p.editIndex]?.id;
        if (id) p.onDeleteBlock(id);
        p.setEditModalLiveBlock(null);
        p.setEditOpen(false);
        p.setEditIndex(null);
      },
    },
    mediaPicker: {
      open: p.mediaPickerOpen,
      hasTarget: !!p.mediaPickerTarget,
      title:
        p.mediaPickerTarget?.field === "heroImageUrl" ||
        p.mediaPickerTarget?.field === "imageUrl" ||
        p.mediaPickerTarget?.field === "heroBleedBackground" ||
        p.mediaPickerTarget?.field === "heroBleedOverlay"
          ? "Velg bilde fra mediearkiv"
          : "Velg video fra mediearkiv",
      onClose: () => {
        p.setMediaPickerOpen(false);
        p.setMediaPickerTarget(null);
      },
      onSelect: (picked) => {
        if (!p.mediaPickerTarget) return;
        const url = typeof picked === "string" ? picked : picked.url;
        const archiveId =
          typeof picked === "object" && picked && "id" in picked && picked.id ? String(picked.id) : undefined;
        if (p.mediaPickerTarget.field === "heroImageUrl") {
          p.setBlockById(p.mediaPickerTarget.blockId, (c) =>
            c.type === "hero" || c.type === "hero_full" ? { ...c, imageId: url } : c
          );
        } else if (p.mediaPickerTarget.field === "heroBleedBackground") {
          p.setBlockById(p.mediaPickerTarget.blockId, (c) =>
            c.type === "hero_bleed"
              ? {
                  ...c,
                  backgroundImageId: url,
                  ...(archiveId ? { backgroundMediaItemId: archiveId } : {}),
                }
              : c
          );
        } else if (p.mediaPickerTarget.field === "heroBleedOverlay") {
          p.setBlockById(p.mediaPickerTarget.blockId, (c) =>
            c.type === "hero_bleed"
              ? {
                  ...c,
                  overlayImageId: url,
                  ...(archiveId ? { overlayMediaItemId: archiveId } : {}),
                }
              : c
          );
        } else if (p.mediaPickerTarget.field === "imageUrl" && p.mediaPickerTarget.itemId == null) {
          p.setBlockById(p.mediaPickerTarget.blockId, (c) =>
            c.type === "image" ? { ...c, imageId: url } : c
          );
        }
        p.setMediaPickerOpen(false);
        p.setMediaPickerTarget(null);
      },
    },
  };
}

export type BuildContentWorkspaceModalShellPropsArgs = BuildContentWorkspaceModalStackPropsArgs & {
  onboardingStep: number;
  setOnboardingStep: (n: number | ((p: number) => number)) => void;
  onboardingDoneKey: string;
  isPitch: boolean;
  pitchStep: number;
  runAiAction: (kind: "improve" | "shorten" | "seo") => void | Promise<void>;
  runAiAudit: () => void | Promise<void>;
  runAiImage: () => void | Promise<void>;
  setShowAfter: (v: boolean | ((p: boolean) => boolean)) => void;
  setPitchStep: (v: number | ((p: number) => number)) => void;
};

export function buildContentWorkspaceModalShellProps(
  p: BuildContentWorkspaceModalShellPropsArgs
): ContentWorkspaceModalShellProps {
  return {
    stack: buildContentWorkspaceModalStackProps(p),
    onboardingStep: p.onboardingStep,
    onOnboardingSkip: () => {
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(p.onboardingDoneKey, "1");
        }
      } catch {
        // ignore localStorage write errors
      }
      p.setOnboardingStep(0);
    },
    onOnboardingStart: () => p.setOnboardingStep(2),
    onOnboardingFinish: () => {
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(p.onboardingDoneKey, "1");
        }
      } catch {
        // ignore localStorage write errors
      }
      p.setOnboardingStep(0);
    },
    isPitch: p.isPitch,
    pitchStep: p.pitchStep,
    onPitchImprove: () => {
      void p.runAiAction("improve");
      p.setShowAfter(true);
      p.setPitchStep(4);
    },
    onPitchAudit: () => {
      void p.runAiAudit();
    },
    onPitchGenerateImage: () => {
      void p.runAiImage();
      p.setShowAfter(true);
    },
    onPitchToggleAfter: () => p.setShowAfter((prev) => !prev),
    onPitchPrev: () => p.setPitchStep((s) => Math.max(1, s - 1)),
    onPitchNext: () => p.setPitchStep((s) => Math.min(7, s + 1)),
  };
}
