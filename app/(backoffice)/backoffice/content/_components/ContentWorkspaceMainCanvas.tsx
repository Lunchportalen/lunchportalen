"use client";

/**
 * Shell composition for the center column: first-class preview workspace or canonical editor body.
 * Parent owns all domain and persistence logic.
 */

import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { DragEndEvent, useSensors } from "@dnd-kit/core";
import { AnimatePresence } from "framer-motion";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { Block } from "./editorBlockTypes";
import type { BodyMode } from "./contentWorkspace.blocks";
import { WorkspaceBody } from "./WorkspaceBody";
import { WorkspacePreview } from "./WorkspacePreview";
import type { PreviewDeviceId, PublicPageVisualInlineEdit } from "./PreviewCanvas";

export type ContentWorkspaceMainCanvasProps = {
  canvasMode: "preview" | "edit";
  previewDevice: PreviewDeviceId;
  historyPreviewBlocks: Block[] | null;
  displayBlocks: Block[];
  historyVersionPreview: HistoryPreviewPayload | null;
  title: string;
  slug: string | null;
  pageSlug: string | null | undefined;
  effectiveId: string | null;
  showPreview: boolean;
  previewLayoutMode: "split" | "full";
  setPreviewLayoutMode: (mode: "split" | "full") => void;
  showBlocks: boolean;
  showPreviewColumn: boolean;
  setShowPreviewColumn: Dispatch<SetStateAction<boolean>>;
  bodyMode: BodyMode;
  bodyParseError: string | null;
  onConvertLegacyBody: () => void;
  onResetInvalidBodyRequest: () => void;
  executeResetInvalidBody: () => void;
  cancelInvalidBodyReset: () => void;
  invalidBodyResetConfirmOpen: boolean;
  blocks: Block[];
  isForsidePage: () => boolean;
  buildHomeFromRepoBusy: boolean;
  isOffline: boolean;
  onFillForsideFromRepo: () => Promise<void>;
  addInsertIndexRef: MutableRefObject<number | null>;
  setBlockPickerOpen: (open: boolean) => void;
  sensors: ReturnType<typeof useSensors>;
  onDragEndReorder: (event: DragEndEvent) => void;
  canReorderBlocks: boolean;
  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  hoverBlockId: string | null;
  setHoverBlockId: (id: string | null) => void;
  blockPulseId: string | null;
  newBlockAnimationIds: Set<string>;
  onMoveBlock: (blockId: string, delta: number) => void;
  onDuplicateBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  setEditIndex: (index: number) => void;
  setEditOpen: (open: boolean) => void;
  aiSuggestLoading: boolean;
  aiSuggestion: string | null;
  setBlockById: (blockId: string, updater: (block: Block) => Block) => void;
  setAiSuggestion: Dispatch<SetStateAction<string | null>>;
  aiScore: number | null;
  aiHints: string[];
  aiImageLoading: boolean;
  blocksForLivePreview: Block[];
  visualInlineEditApi: PublicPageVisualInlineEdit | null;
  setHistoryVersionPreview: (payload: HistoryPreviewPayload | null) => void;
  onNavigateToGlobalDesignSettings?: () => void;
  /** Layered CMS design meta for preview (historikk vs utkast avstemmes i parent). */
  pageCmsMetaForPreview: Record<string, unknown>;
};

export function ContentWorkspaceMainCanvas(props: ContentWorkspaceMainCanvasProps) {
  const {
    canvasMode,
    previewDevice,
    historyPreviewBlocks,
    displayBlocks,
    historyVersionPreview,
    title,
    slug,
    pageSlug,
    effectiveId,
    bodyMode,
    bodyParseError,
    onConvertLegacyBody,
    onResetInvalidBodyRequest,
    executeResetInvalidBody,
    cancelInvalidBodyReset,
    invalidBodyResetConfirmOpen,
    blocks,
    isForsidePage,
    buildHomeFromRepoBusy,
    isOffline,
    onFillForsideFromRepo,
    addInsertIndexRef,
    setBlockPickerOpen,
    sensors,
    onDragEndReorder,
    canReorderBlocks,
    selectedBlockId,
    setSelectedBlockId,
    hoverBlockId,
    setHoverBlockId,
    blockPulseId,
    newBlockAnimationIds,
    onMoveBlock,
    onDuplicateBlock,
    onDeleteBlock,
    setEditIndex,
    setEditOpen,
    aiSuggestLoading,
    aiSuggestion,
    setBlockById,
    setAiSuggestion,
    aiScore,
    aiHints,
    aiImageLoading,
    blocksForLivePreview,
    visualInlineEditApi,
    setHistoryVersionPreview,
    onNavigateToGlobalDesignSettings,
    pageCmsMetaForPreview,
  } = props;

  return (
    <AnimatePresence mode="wait">
      {canvasMode === "preview" ? (
        <WorkspacePreview
          previewDevice={previewDevice}
          bodyMode={bodyMode}
          bodyParseError={bodyParseError}
          historyPreviewBlocks={historyPreviewBlocks}
          displayBlocks={historyPreviewBlocks ?? blocksForLivePreview}
          historyVersionPreview={historyVersionPreview}
          title={title}
          slug={slug}
          pageSlug={pageSlug}
          effectiveId={effectiveId}
          pageCmsMetaForPreview={pageCmsMetaForPreview}
        />
      ) : (
        <WorkspaceBody
          bodyMode={bodyMode}
          bodyParseError={bodyParseError}
          onConvertLegacyBody={onConvertLegacyBody}
          onResetInvalidBodyRequest={onResetInvalidBodyRequest}
          executeResetInvalidBody={executeResetInvalidBody}
          cancelInvalidBodyReset={cancelInvalidBodyReset}
          invalidBodyResetConfirmOpen={invalidBodyResetConfirmOpen}
          blocks={blocks}
          displayBlocks={displayBlocks}
          isForsidePage={isForsidePage}
          buildHomeFromRepoBusy={buildHomeFromRepoBusy}
          isOffline={isOffline}
          onFillForsideFromRepo={onFillForsideFromRepo}
          addInsertIndexRef={addInsertIndexRef}
          setBlockPickerOpen={setBlockPickerOpen}
          sensors={sensors}
          onDragEndReorder={onDragEndReorder}
          canReorderBlocks={canReorderBlocks}
          selectedBlockId={selectedBlockId}
          setSelectedBlockId={setSelectedBlockId}
          hoverBlockId={hoverBlockId}
          setHoverBlockId={setHoverBlockId}
          blockPulseId={blockPulseId}
          newBlockAnimationIds={newBlockAnimationIds}
          onMoveBlock={onMoveBlock}
          onDuplicateBlock={onDuplicateBlock}
          onDeleteBlock={onDeleteBlock}
          setEditIndex={setEditIndex}
          setEditOpen={setEditOpen}
          aiSuggestLoading={aiSuggestLoading}
          aiSuggestion={aiSuggestion}
          setBlockById={setBlockById}
          setAiSuggestion={setAiSuggestion}
          aiScore={aiScore}
          aiHints={aiHints}
          aiImageLoading={aiImageLoading}
          blocksForLivePreview={blocksForLivePreview}
          visualInlineEditApi={visualInlineEditApi}
          setHistoryVersionPreview={setHistoryVersionPreview}
          title={title}
          onNavigateToGlobalDesignSettings={onNavigateToGlobalDesignSettings}
          pageCmsMetaForPreview={pageCmsMetaForPreview}
        />
      )}
    </AnimatePresence>
  );
}
