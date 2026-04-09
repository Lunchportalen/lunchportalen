/**
 * Chrome shell input — typer, gruppering og `chromeShell*`-fabrikker.
 * Ren pass-through til `buildContentWorkspaceChromeProps`; ingen domene-/preview-logikk.
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
import type { BlockEditorDataTypeDefinition } from "@/lib/cms/blocks/blockEditorDataTypes";
import type { DocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import type { Block } from "./editorBlockTypes";
import type { BodyMode } from "./contentWorkspace.blocks";
import type { ContentPage } from "./ContentWorkspaceState";
import type { ContentWorkspaceChromeProps } from "./ContentWorkspaceChrome";
import type {
  ContentWorkspacePropertiesRailProps,
} from "./ContentWorkspacePropertiesRail";
import type { DocumentTypeEntry } from "./documentTypes";
import type { ContentWorkspaceChromeBuildInput } from "./contentWorkspaceChromeProps";
import { buildContentWorkspaceChromeProps } from "./contentWorkspaceChromeProps";
import type { BackofficeContentEntityWorkspaceViewId } from "@/lib/cms/backofficeExtensionRegistry";
import type { ContentBellissimaInspectorSectionId } from "@/lib/cms/backofficeWorkspaceContextModel";

type MainView = BackofficeContentEntityWorkspaceViewId;

/** Ytre ramme + page-ref for chrome. */
export type ChromeShellFrame = Pick<
  ContentWorkspaceChromeBuildInput,
  "page" | "isContentTab" | "hideLegacyNav" | "editorCanvasRef" | "rightRailSlots"
>;

export type ChromeShellShared = Pick<
  ContentWorkspaceChromeBuildInput,
  | "mainView"
  | "setMainView"
  | "canvasMode"
  | "previewDevice"
  | "title"
  | "slug"
  | "setTitle"
  | "setCanvasMode"
  | "setPreviewDevice"
  | "isOffline"
>;

export type ChromeShellEditorOnly = Pick<
  ContentWorkspaceChromeBuildInput,
  | "statusLabel"
  | "statusLine"
  | "supportSnapshot"
  | "supportCopyFeedback"
  | "canPublish"
  | "canUnpublish"
  | "selectedId"
  | "publishDisabledTitle"
  | "unpublishDisabledTitle"
  | "copySupportSnapshot"
  | "performSave"
  | "reloadDetailFromServer"
  | "onSave"
  | "onSetStatus"
  | "canSave"
  | "recoveryBannerVisible"
  | "outboxData"
  | "hasFingerprintConflict"
  | "outboxDetailsExpanded"
  | "setOutboxDetailsExpanded"
  | "copyOutboxSafetyExport"
  | "outboxCopyFeedback"
  | "onRestoreOutbox"
  | "onDiscardOutbox"
  | "formatDate"
  | "canOpenPublic"
  | "onOpenPublicPage"
  | "publishReadiness"
>;

export type ChromeShellMainOnly = Pick<
  ContentWorkspaceChromeBuildInput,
  | "historyPreviewBlocks"
  | "displayBlocks"
  | "historyVersionPreview"
  | "effectiveId"
  | "showPreview"
  | "previewLayoutMode"
  | "setPreviewLayoutMode"
  | "showBlocks"
  | "showPreviewColumn"
  | "setShowPreviewColumn"
  | "bodyMode"
  | "bodyParseError"
  | "onConvertLegacyBody"
  | "onResetInvalidBodyRequest"
  | "executeResetInvalidBody"
  | "cancelInvalidBodyReset"
  | "invalidBodyResetConfirmOpen"
  | "blocks"
  | "isForsidePage"
  | "buildHomeFromRepoBusy"
  | "onFillForsideFromRepo"
  | "addInsertIndexRef"
  | "setBlockPickerOpen"
  | "sensors"
  | "onDragEndReorder"
  | "canReorderBlocks"
  | "selectedBlockId"
  | "setSelectedBlockId"
  | "hoverBlockId"
  | "setHoverBlockId"
  | "blockPulseId"
  | "newBlockAnimationIds"
  | "onMoveBlock"
  | "onDuplicateBlock"
  | "onDeleteBlock"
  | "setEditIndex"
  | "setEditOpen"
  | "aiSuggestLoading"
  | "aiSuggestion"
  | "setBlockById"
  | "setAiSuggestion"
  | "aiScore"
  | "aiHints"
  | "aiImageLoading"
  | "blocksForLivePreview"
  | "visualInlineEditApi"
  | "setHistoryVersionPreview"
  | "pageCmsMetaForPreview"
  | "onNavigateToGlobalDesignSettings"
>;

export type ChromeShellProperties = Pick<
  ContentWorkspaceChromeBuildInput,
  | "inspectorSection"
  | "setInspectorSection"
  | "documentTypeAlias"
  | "setDocumentTypeAlias"
  | "clearEnvelopeScalarLayers"
  | "invariantEnvelopeFields"
  | "cultureEnvelopeFields"
  | "setInvariantEnvelopeFields"
  | "setCultureEnvelopeFields"
  | "editorLocale"
  | "setEditorLocale"
  | "documentTypes"
  | "meta"
  | "setMeta"
  | "selectedBlockForInspector"
  | "blockInspectorCtx"
  | "aiBusyToolId"
  | "handleAiSeoOptimize"
  | "mergedBlockEditorDataTypes"
  | "mergedDocumentTypeDefinitions"
>;

export type ChromeShellTri = Pick<
  ContentWorkspaceChromeBuildInput,
  "onSelectBlockFromTree" | "aiCapability" | "aiSummary" | "aiError"
>;

export type ChromeShellWireInput = {
  frame: ChromeShellFrame;
  shared: ChromeShellShared;
  editor: ChromeShellEditorOnly;
  main: ChromeShellMainOnly;
  properties: ChromeShellProperties;
  tri: ChromeShellTri;
};

export function mergeChromeShellInput(groups: ChromeShellWireInput): ContentWorkspaceChromeBuildInput {
  return {
    ...groups.frame,
    ...groups.shared,
    ...groups.editor,
    ...groups.main,
    ...groups.properties,
    ...groups.tri,
  };
}

/** Gruppert wire → samme chrome-props som tidligere. */
export function buildWorkspaceChromeShellPropsFromWire(w: ChromeShellWireInput): ContentWorkspaceChromeProps {
  return buildContentWorkspaceChromeProps(mergeChromeShellInput(w));
}

export function chromeShellFrame(
  page: ContentPage | null,
  isContentTab: boolean,
  hideLegacyNav: boolean,
  editorCanvasRef: RefObject<HTMLElement | null>,
  rightRailSlots: ContentWorkspaceChromeProps["rightRailSlots"]
): ChromeShellFrame {
  return { page, isContentTab, hideLegacyNav, editorCanvasRef, rightRailSlots };
}

export function chromeShellShared(
  mainView: MainView,
  setMainView: (v: MainView) => void,
  canvasMode: "preview" | "edit",
  previewDevice: PreviewDeviceId,
  title: string,
  slug: string | null,
  setTitle: (v: string) => void,
  setCanvasMode: (m: "preview" | "edit") => void,
  setPreviewDevice: (d: PreviewDeviceId) => void,
  isOffline: boolean
): ChromeShellShared {
  return {
    mainView,
    setMainView,
    canvasMode,
    previewDevice,
    title,
    slug,
    setTitle,
    setCanvasMode,
    setPreviewDevice,
    isOffline,
  };
}

export function chromeShellEditor(
  statusLabel: PageStatus,
  statusLine: StatusLineState,
  supportSnapshot: SupportSnapshot | null | undefined,
  supportCopyFeedback: "ok" | "fail" | null,
  canPublish: boolean,
  canUnpublish: boolean,
  selectedId: string,
  publishDisabledTitle: string | undefined,
  unpublishDisabledTitle: string | undefined,
  copySupportSnapshot: () => void,
  performSave: () => void | Promise<unknown>,
  reloadDetailFromServer: () => void,
  onSave: () => void | Promise<void>,
  onSetStatus: (s: PageStatus) => void | Promise<void>,
  canSave: boolean,
  recoveryBannerVisible: boolean,
  outboxData: OutboxEntry | null,
  hasFingerprintConflict: boolean,
  outboxDetailsExpanded: boolean,
  setOutboxDetailsExpanded: Dispatch<SetStateAction<boolean>>,
  copyOutboxSafetyExport: (entry: OutboxEntry) => void,
  outboxCopyFeedback: Record<string, "ok" | "fail" | undefined>,
  onRestoreOutbox: () => void,
  onDiscardOutbox: () => void,
  formatDate: (v: string | null | undefined) => string,
  canOpenPublic: boolean,
  onOpenPublicPage: () => void,
  publishReadiness: boolean
): ChromeShellEditorOnly {
  return {
    statusLabel,
    statusLine,
    supportSnapshot,
    supportCopyFeedback,
    canPublish,
    canUnpublish,
    selectedId,
    publishDisabledTitle,
    unpublishDisabledTitle,
    copySupportSnapshot,
    performSave,
    reloadDetailFromServer,
    onSave,
    onSetStatus,
    canSave,
    recoveryBannerVisible,
    outboxData,
    hasFingerprintConflict,
    outboxDetailsExpanded,
    setOutboxDetailsExpanded,
    copyOutboxSafetyExport,
    outboxCopyFeedback,
    onRestoreOutbox,
    onDiscardOutbox,
    formatDate,
    canOpenPublic,
    onOpenPublicPage,
    publishReadiness,
  };
}

export function chromeShellMain(
  historyPreviewBlocks: Block[] | null,
  displayBlocks: Block[],
  historyVersionPreview: HistoryPreviewPayload | null,
  effectiveId: string | null,
  showPreview: boolean,
  previewLayoutMode: "split" | "full",
  setPreviewLayoutMode: (mode: "split" | "full") => void,
  showBlocks: boolean,
  showPreviewColumn: boolean,
  setShowPreviewColumn: Dispatch<SetStateAction<boolean>>,
  bodyMode: BodyMode,
  bodyParseError: string | null,
  onConvertLegacyBody: () => void,
  onResetInvalidBodyRequest: () => void,
  executeResetInvalidBody: () => void,
  cancelInvalidBodyReset: () => void,
  invalidBodyResetConfirmOpen: boolean,
  blocks: Block[],
  isForsidePage: () => boolean,
  buildHomeFromRepoBusy: boolean,
  onFillForsideFromRepo: () => Promise<void>,
  addInsertIndexRef: MutableRefObject<number | null>,
  setBlockPickerOpen: (open: boolean) => void,
  sensors: ReturnType<typeof useSensors>,
  onDragEndReorder: (event: DragEndEvent) => void,
  canReorderBlocks: boolean,
  selectedBlockId: string | null,
  setSelectedBlockId: (id: string | null) => void,
  hoverBlockId: string | null,
  setHoverBlockId: (id: string | null) => void,
  blockPulseId: string | null,
  newBlockAnimationIds: Set<string>,
  onMoveBlock: (blockId: string, delta: number) => void,
  onDuplicateBlock: (blockId: string) => void,
  onDeleteBlock: (blockId: string) => void,
  setEditIndex: (index: number) => void,
  setEditOpen: (open: boolean) => void,
  aiSuggestLoading: boolean,
  aiSuggestion: string | null,
  setBlockById: (blockId: string, updater: (block: Block) => Block) => void,
  setAiSuggestion: Dispatch<SetStateAction<string | null>>,
  aiScore: number | null,
  aiHints: string[],
  aiImageLoading: boolean,
  blocksForLivePreview: Block[],
  visualInlineEditApi: PublicPageVisualInlineEdit | null,
  setHistoryVersionPreview: (payload: HistoryPreviewPayload | null) => void,
  pageCmsMetaForPreview: Record<string, unknown>,
  onNavigateToGlobalDesignSettings?: () => void
): ChromeShellMainOnly {
  return {
    historyPreviewBlocks,
    displayBlocks,
    historyVersionPreview,
    effectiveId,
    showPreview,
    previewLayoutMode,
    setPreviewLayoutMode,
    showBlocks,
    showPreviewColumn,
    setShowPreviewColumn,
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
    pageCmsMetaForPreview,
    onNavigateToGlobalDesignSettings,
  };
}

export function chromeShellProperties(
  inspectorSection: ContentBellissimaInspectorSectionId,
  setInspectorSection: Dispatch<SetStateAction<ContentBellissimaInspectorSectionId>>,
  documentTypeAlias: string | null,
  setDocumentTypeAlias: Dispatch<SetStateAction<string | null>>,
  clearEnvelopeScalarLayers: ContentWorkspacePropertiesRailProps["clearEnvelopeScalarLayers"],
  invariantEnvelopeFields: ContentWorkspacePropertiesRailProps["invariantEnvelopeFields"],
  cultureEnvelopeFields: ContentWorkspacePropertiesRailProps["cultureEnvelopeFields"],
  setInvariantEnvelopeFields: ContentWorkspacePropertiesRailProps["setInvariantEnvelopeFields"],
  setCultureEnvelopeFields: ContentWorkspacePropertiesRailProps["setCultureEnvelopeFields"],
  editorLocale: ContentWorkspacePropertiesRailProps["editorLocale"],
  setEditorLocale: ContentWorkspacePropertiesRailProps["setEditorLocale"],
  documentTypes: DocumentTypeEntry[],
  meta: ContentWorkspacePropertiesRailProps["meta"],
  setMeta: ContentWorkspacePropertiesRailProps["setMeta"],
  selectedBlockForInspector: Block | null,
  blockInspectorCtx: BlockInspectorFieldsCtx,
  aiBusyToolId: string | null,
  handleAiSeoOptimize: ContentWorkspacePropertiesRailProps["handleAiSeoOptimize"],
  mergedBlockEditorDataTypes: Record<string, BlockEditorDataTypeDefinition> | null,
  mergedDocumentTypeDefinitions: Record<string, DocumentTypeDefinition> | null,
): ChromeShellProperties {
  return {
    inspectorSection,
    setInspectorSection,
    documentTypeAlias,
    setDocumentTypeAlias,
    clearEnvelopeScalarLayers,
    invariantEnvelopeFields,
    cultureEnvelopeFields,
    setInvariantEnvelopeFields,
    setCultureEnvelopeFields,
    editorLocale,
    setEditorLocale,
    documentTypes,
    meta,
    setMeta,
    selectedBlockForInspector,
    blockInspectorCtx,
    aiBusyToolId,
    handleAiSeoOptimize,
    mergedBlockEditorDataTypes,
    mergedDocumentTypeDefinitions,
  };
}

export function chromeShellTri(
  onSelectBlockFromTree: (id: string) => void,
  aiCapability: ChromeShellTri["aiCapability"],
  aiSummary: string | null,
  aiError: string | null
): ChromeShellTri {
  return {
    onSelectBlockFromTree,
    aiCapability,
    aiSummary,
    aiError,
  };
}
