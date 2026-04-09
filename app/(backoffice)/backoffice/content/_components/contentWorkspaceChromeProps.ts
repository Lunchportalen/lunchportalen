/**
 * Ren chrome-orchestrering for ContentWorkspaceChrome — kun mapping av eksisterende state/callbacks.
 * Ingen ny forretningslogikk; samme preview-kjede (blocksForLivePreview, visualInlineEditApi). blockInspectorCtx lever kun til properties-rail.
 */

import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import type { useSensors } from "@dnd-kit/core";
import type { BlockInspectorFieldsCtx } from "./BlockInspectorFields";
import type { PageStatus } from "./contentWorkspace.types";
import type { OutboxEntry } from "./contentWorkspace.outbox";
import type { StatusLineState, SupportSnapshot } from "./types";
import type { PreviewDeviceId } from "./PreviewCanvas";
import type { PublicPageVisualInlineEdit } from "./PreviewCanvas";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { Block } from "./editorBlockTypes";
import type { BodyMode } from "./contentWorkspace.blocks";
import type { ContentPage } from "./ContentWorkspaceState";
import type { ContentWorkspaceChromeProps, ContentWorkspaceChromeTriPaneLeftProps } from "./ContentWorkspaceChrome";
import type { ContentWorkspaceEditorChromeProps } from "./ContentWorkspaceEditorChrome";
import type { ContentWorkspaceMainCanvasProps } from "./ContentWorkspaceMainCanvas";
import type {
  ContentWorkspacePropertiesRailProps,
} from "./ContentWorkspacePropertiesRail";
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import type { DocumentTypeEntry } from "./documentTypes";
import type { BackofficeContentEntityWorkspaceViewId } from "@/lib/cms/backofficeExtensionRegistry";
import type { ContentBellissimaInspectorSectionId } from "@/lib/cms/backofficeWorkspaceContextModel";

type MainView = BackofficeContentEntityWorkspaceViewId;

export type ContentWorkspaceChromeBuildInput = {
  page: ContentPage | null;
  statusLabel: PageStatus;
  statusLine: StatusLineState;
  supportSnapshot: SupportSnapshot | null | undefined;
  supportCopyFeedback: "ok" | "fail" | null;
  canPublish: boolean;
  canUnpublish: boolean;
  selectedId: string;
  isOffline: boolean;
  publishDisabledTitle?: string;
  unpublishDisabledTitle?: string;
  copySupportSnapshot: () => void;
  /** Samme som tidligere onRetrySave — parent kan returnere bool fra lagring. */
  performSave: () => void | Promise<unknown>;
  reloadDetailFromServer: () => void;
  onSave: () => void | Promise<void>;
  onSetStatus: (s: PageStatus) => void | Promise<void>;
  canSave: boolean;
  recoveryBannerVisible: boolean;
  outboxData: OutboxEntry | null;
  hasFingerprintConflict: boolean;
  outboxDetailsExpanded: boolean;
  setOutboxDetailsExpanded: Dispatch<SetStateAction<boolean>>;
  copyOutboxSafetyExport: (entry: OutboxEntry) => void;
  outboxCopyFeedback: Record<string, "ok" | "fail" | undefined>;
  onRestoreOutbox: () => void;
  onDiscardOutbox: () => void;
  formatDate: (v: string | null | undefined) => string;
  mainView: MainView;
  setMainView: (v: MainView) => void;
  canvasMode: "preview" | "edit";
  title: string;
  slug: string | null;
  setTitle: (v: string) => void;
  setCanvasMode: (m: "preview" | "edit") => void;
  previewDevice: PreviewDeviceId;
  setPreviewDevice: (d: PreviewDeviceId) => void;
  canOpenPublic: boolean;
  onOpenPublicPage: () => void;
  publishReadiness: boolean;
  isContentTab: boolean;
  hideLegacyNav: boolean;
  editorCanvasRef: RefObject<HTMLElement | null>;
  rightRailSlots: ContentWorkspaceChromeProps["rightRailSlots"];
  historyPreviewBlocks: Block[] | null;
  displayBlocks: Block[];
  historyVersionPreview: HistoryPreviewPayload | null;
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
  blockInspectorCtx: BlockInspectorFieldsCtx;
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
  /** Forhåndsvisning: `meta` for page/section design (historikk = snapshot-body meta). */
  pageCmsMetaForPreview: Record<string, unknown>;
  /** Åpner Global → Innhold og innstillinger → Generelt (design tokens). */
  onNavigateToGlobalDesignSettings?: () => void;
  inspectorSection: ContentBellissimaInspectorSectionId;
  setInspectorSection: Dispatch<SetStateAction<ContentBellissimaInspectorSectionId>>;
  documentTypeAlias: string | null;
  setDocumentTypeAlias: Dispatch<SetStateAction<string | null>>;
  clearEnvelopeScalarLayers: ContentWorkspacePropertiesRailProps["clearEnvelopeScalarLayers"];
  invariantEnvelopeFields: ContentWorkspacePropertiesRailProps["invariantEnvelopeFields"];
  cultureEnvelopeFields: ContentWorkspacePropertiesRailProps["cultureEnvelopeFields"];
  setInvariantEnvelopeFields: ContentWorkspacePropertiesRailProps["setInvariantEnvelopeFields"];
  setCultureEnvelopeFields: ContentWorkspacePropertiesRailProps["setCultureEnvelopeFields"];
  editorLocale: ContentWorkspacePropertiesRailProps["editorLocale"];
  setEditorLocale: ContentWorkspacePropertiesRailProps["setEditorLocale"];
  documentTypes: DocumentTypeEntry[];
  meta: ContentWorkspacePropertiesRailProps["meta"];
  setMeta: ContentWorkspacePropertiesRailProps["setMeta"];
  selectedBlockForInspector: Block | null;
  aiBusyToolId: string | null;
  handleAiSeoOptimize: ContentWorkspacePropertiesRailProps["handleAiSeoOptimize"];
  onSelectBlockFromTree: (id: string) => void;
  aiCapability: ContentWorkspaceChromeTriPaneLeftProps["aiCapability"];
  aiSummary: string | null;
  aiError: string | null;
  mergedBlockEditorDataTypes: Record<string, BlockEditorDataTypeDefinition> | null;
  mergedDocumentTypeDefinitions: Record<string, DocumentTypeDefinition> | null;
};

export function buildContentWorkspaceChromeProps(i: ContentWorkspaceChromeBuildInput): ContentWorkspaceChromeProps {
  const p = i.page;
  const editorChrome: ContentWorkspaceEditorChromeProps = {
    statusLabel: i.statusLabel,
    pageTitle: p?.title || "Untitled",
    pageSlug: p?.slug || "—",
    statusLine: i.statusLine,
    supportSnapshot: i.supportSnapshot,
    supportCopyFeedback: i.supportCopyFeedback,
    canPublish: i.canPublish,
    canUnpublish: i.canUnpublish,
    selectedId: i.selectedId,
    pageExists: !!p,
    isOffline: i.isOffline,
    publishDisabledTitle: i.publishDisabledTitle,
    unpublishDisabledTitle: i.unpublishDisabledTitle,
    onCopySupportSnapshot: () => void i.copySupportSnapshot(),
    onRetrySave: () => void i.performSave(),
    onReload: i.reloadDetailFromServer,
    onPublish: async () => {
      if (i.canSave) await i.onSave();
      if (i.canPublish) void i.onSetStatus("published");
    },
    onUnpublish: () => void i.onSetStatus("draft"),
    recoveryBannerVisible: i.recoveryBannerVisible,
    outboxData: i.outboxData,
    hasFingerprintConflict: i.hasFingerprintConflict,
    outboxDetailsExpanded: i.outboxDetailsExpanded,
    setOutboxDetailsExpanded: i.setOutboxDetailsExpanded,
    copyOutboxSafetyExport: i.copyOutboxSafetyExport,
    outboxCopyFeedback: i.outboxCopyFeedback,
    onRestoreOutbox: i.onRestoreOutbox,
    onDiscardOutbox: i.onDiscardOutbox,
    formatDate: i.formatDate,
    mainView: i.mainView,
    setMainView: i.setMainView,
    canvasMode: i.canvasMode,
    title: i.title,
    setTitle: i.setTitle,
    setCanvasMode: i.setCanvasMode,
    previewDevice: i.previewDevice,
    setPreviewDevice: i.setPreviewDevice,
    pageUpdatedAt: p?.updated_at,
    pageId: p?.id ?? "",
    canOpenPublic: i.canOpenPublic,
    onOpenPublicPage: i.onOpenPublicPage,
    publishReadiness: i.publishReadiness,
  };

  const mainCanvas: ContentWorkspaceMainCanvasProps = {
    canvasMode: i.canvasMode,
    previewDevice: i.previewDevice,
    historyPreviewBlocks: i.historyPreviewBlocks,
    displayBlocks: i.displayBlocks,
    historyVersionPreview: i.historyVersionPreview,
    title: i.title,
    slug: i.slug,
    pageSlug: p?.slug,
    effectiveId: i.effectiveId,
    showPreview: i.showPreview,
    previewLayoutMode: i.previewLayoutMode,
    setPreviewLayoutMode: i.setPreviewLayoutMode,
    showBlocks: i.showBlocks,
    showPreviewColumn: i.showPreviewColumn,
    setShowPreviewColumn: i.setShowPreviewColumn,
    bodyMode: i.bodyMode,
    bodyParseError: i.bodyParseError,
    onConvertLegacyBody: i.onConvertLegacyBody,
    onResetInvalidBodyRequest: i.onResetInvalidBodyRequest,
    executeResetInvalidBody: i.executeResetInvalidBody,
    cancelInvalidBodyReset: i.cancelInvalidBodyReset,
    invalidBodyResetConfirmOpen: i.invalidBodyResetConfirmOpen,
    blocks: i.blocks,
    isForsidePage: i.isForsidePage,
    buildHomeFromRepoBusy: i.buildHomeFromRepoBusy,
    isOffline: i.isOffline,
    onFillForsideFromRepo: i.onFillForsideFromRepo,
    addInsertIndexRef: i.addInsertIndexRef,
    setBlockPickerOpen: i.setBlockPickerOpen,
    sensors: i.sensors,
    onDragEndReorder: i.onDragEndReorder,
    canReorderBlocks: i.canReorderBlocks,
    selectedBlockId: i.selectedBlockId,
    setSelectedBlockId: i.setSelectedBlockId,
    hoverBlockId: i.hoverBlockId,
    setHoverBlockId: i.setHoverBlockId,
    blockPulseId: i.blockPulseId,
    newBlockAnimationIds: i.newBlockAnimationIds,
    onMoveBlock: i.onMoveBlock,
    onDuplicateBlock: i.onDuplicateBlock,
    onDeleteBlock: i.onDeleteBlock,
    setEditIndex: i.setEditIndex,
    setEditOpen: i.setEditOpen,
    aiSuggestLoading: i.aiSuggestLoading,
    aiSuggestion: i.aiSuggestion,
    setBlockById: i.setBlockById,
    setAiSuggestion: i.setAiSuggestion,
    aiScore: i.aiScore,
    aiHints: i.aiHints,
    aiImageLoading: i.aiImageLoading,
    blocksForLivePreview: i.blocksForLivePreview,
    visualInlineEditApi: i.visualInlineEditApi,
    setHistoryVersionPreview: i.setHistoryVersionPreview,
    pageCmsMetaForPreview: i.pageCmsMetaForPreview,
    onNavigateToGlobalDesignSettings: i.onNavigateToGlobalDesignSettings,
  };

  const propertiesRail: ContentWorkspacePropertiesRailProps = {
    inspectorSection: i.inspectorSection,
    setInspectorSection: i.setInspectorSection,
    documentTypeAlias: i.documentTypeAlias,
    setDocumentTypeAlias: i.setDocumentTypeAlias,
    clearEnvelopeScalarLayers: i.clearEnvelopeScalarLayers,
    invariantEnvelopeFields: i.invariantEnvelopeFields,
    cultureEnvelopeFields: i.cultureEnvelopeFields,
    setInvariantEnvelopeFields: i.setInvariantEnvelopeFields,
    setCultureEnvelopeFields: i.setCultureEnvelopeFields,
    editorLocale: i.editorLocale,
    setEditorLocale: i.setEditorLocale,
    documentTypes: i.documentTypes,
    meta: i.meta,
    setMeta: i.setMeta,
    page: p,
    title: i.title,
    slug: i.slug,
    showBlocks: i.showBlocks,
    selectedBlockForInspector: i.selectedBlockForInspector,
    blocks: i.blocks,
    blockInspectorCtx: i.blockInspectorCtx,
    statusLabel: i.statusLabel,
    isOffline: i.isOffline,
    effectiveId: i.effectiveId,
    aiBusyToolId: i.aiBusyToolId,
    handleAiSeoOptimize: i.handleAiSeoOptimize,
    mergedBlockEditorDataTypes: i.mergedBlockEditorDataTypes,
    mergedDocumentTypeDefinitions: i.mergedDocumentTypeDefinitions,
  };

  const triPaneLeft: ContentWorkspaceChromeTriPaneLeftProps = {
    selectedId: i.selectedId,
    selectedBlockId: i.selectedBlockId,
    onSelectBlockFromTree: i.onSelectBlockFromTree,
    hoverBlockId: i.hoverBlockId,
    setHoverBlockId: i.setHoverBlockId,
    displayBlocks: i.displayBlocks,
    showBlocks: i.showBlocks,
    title: i.title,
    page: p,
    slug: i.slug,
    effectiveId: i.effectiveId,
    aiCapability: i.aiCapability,
    aiSummary: i.aiSummary,
    aiError: i.aiError,
  };

  return {
    editorChrome,
    isContentTab: i.isContentTab,
    canvasMode: i.canvasMode,
    hideLegacyNav: i.hideLegacyNav,
    editorCanvasRef: i.editorCanvasRef,
    mainCanvas,
    propertiesRail,
    rightRailSlots: i.rightRailSlots,
    triPaneLeft,
  };
}
