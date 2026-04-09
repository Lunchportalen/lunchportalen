"use client";

import { useRouter } from "next/navigation";
import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { useToast } from "@/components/ui/toast";
import { debounce } from "@/lib/ai/debounce";
import { isBlockTypeAllowedForDocumentType } from "@/lib/cms/blockAllowlistGovernance";
import { canAddBlockForDataType, getBlockEditorDataTypeForDocument } from "@/lib/cms/blocks/blockEditorDataTypes";
import { getBaselineDocumentTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import { mergeVisualInlinePatchIntoBlock } from "@/lib/cms/blocks/blockEntryContract";
import { mergeContractIntoMeta } from "@/lib/cms/model/pageAiContractHelpers";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";
import { useAiPageBuilder } from "@/lib/hooks/useAiPageBuilder";
import { useSectionSidebarContent } from "../_workspace/ContentWorkspaceHost";
import {
  isForside, tryParseBlockListFromBody, documentTypes, type BlockList,
  deriveBodyFromParse, looksJsonLike, normalizeBlock, parseBodyEnvelope, parseBodyToBlocks, serializeBlocksToBody, snapshotBodyFromPageBody, toRawBodyString, type BodyMode,
  clearOutbox, fingerprintOutboxDraft, getOutboxEntryKey, readOutbox, writeOutbox, type OutboxDraft, type OutboxEntry, type OutboxUiStatus,
  makeSnapshot,
  logApiRidFromBody, type ApiOk,
  mapSerializedAiBlockToBlock,
  backofficePreviewPath,
  useBlockInspectorWorkspaceCtxFromShell,
  useBlockListDragEndHandler,
  useChromeVisualPreviewShellPair, useContentWorkspaceUrlModeFlags,
} from "./contentWorkspaceWorkspaceRootImports";
import { getBlockLabel } from "./_stubs";
import { getBlockTreeLabel } from "./blockLabels";
import { ContentAiContextPanel } from "./ContentAiContextPanel";
import { ContentWorkspaceAuxiliaryShell } from "./ContentWorkspaceAuxiliaryShell";
import { ContentWorkspaceEditorChrome } from "./ContentWorkspaceEditorChrome";
import { ContentWorkspaceModalShell } from "./contentWorkspaceModalShellInput";
import { buildContentWorkspaceAuxiliaryShellProps } from "./contentWorkspaceAuxiliaryShellProps";
import { useBlockEditorDataTypesMergedOptional } from "./BlockEditorDataTypesMergedContext";
import { useDocumentTypeDefinitionsMergedOptional } from "./DocumentTypeDefinitionsMergedContext";
import { buildContentWorkspacePageEditorShellBundle } from "./contentWorkspacePageEditorShellInput";
import {
  buildContentWorkspaceModalShellPropsFromWorkspaceFlatFields,
  buildContentWorkspaceTriPaneShellMountPropsFromWorkspaceBundle,
} from "./contentWorkspaceTriPaneShellBundle";
import { copyOutboxSafetyExportToClipboard } from "./contentWorkspace.outbox";
import { ContentWorkspaceDevDebugOverlays } from "./contentWorkspaceShellMountFragments";
import { submitCreateContentPageFromForm } from "./contentWorkspaceCreatePageSubmit";
import { ContentWorkspacePageEditorShell } from "./ContentWorkspacePageEditorShell";
import { ContentWorkspaceLegacySidebar } from "./ContentWorkspaceLegacySidebar";
import { EditorStructureTree } from "./EditorStructureTree";
import { LeftSidebar } from "./LeftSidebar";
import { RightPanel } from "./RightPanel";
import {
  buildWorkspaceAuxiliaryShellArgs,
  buildWorkspaceChromeShellPropsFromWire,
} from "./contentWorkspaceShellInputContexts";
import { useContentWorkspaceBellissima } from "./useContentWorkspaceBellissima";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { BlockInspectorFieldsCtx } from "./BlockInspectorFields";
import type { EditableBlock } from "./BlockEditModal";
import type { Block, BlockType } from "./editorBlockTypes";
import { WorkspaceBody } from "./WorkspaceBody";
import { WorkspaceInspector } from "./WorkspaceInspector";
import { WorkspacePreview } from "./WorkspacePreview";
import type { PageAiContract } from "@/lib/cms/model/pageAiContract";
import type { EditorAiFeature } from "@/domain/backoffice/ai/metrics/editorAiMetricsTypes";
import type { SaveState } from "./types";
import type { ContentPage, ContentPageListItem, ListData, PageData } from "./ContentWorkspaceState";
import {
  useContentWorkspaceAi,
  useContentWorkspaceRunAiSuggest,
  type EditorBlockForPatch,
} from "./useContentWorkspaceAi";
import { useContentWorkspaceBlocks } from "./useContentWorkspaceBlocks";
import { useContentWorkspaceData } from "./useContentWorkspaceData";
import { useContentWorkspaceOverlays } from "./useContentWorkspaceOverlays";
import { useContentWorkspacePanelRequests } from "./useContentWorkspacePanelAi";
import { useContentWorkspacePersistence } from "./useContentWorkspacePersistence";
import { useContentWorkspacePresentationState } from "./useContentWorkspacePresentationState";
import { useContentWorkspaceRichTextTransport } from "./useContentWorkspaceRichTextAi";
import { useContentWorkspaceRightRailSlots } from "./contentWorkspaceRightRailSlots";
import { useContentWorkspaceShell } from "./useContentWorkspaceShell";
import { useContentWorkspaceUi } from "./useContentWorkspaceUi";
import { useContentWorkspaceDemoWowPitchOverlayEffects, useContentWorkspaceOnboardingOverlayEffects } from "./contentWorkspaceModalStackViewModel";
import {
  useChromeShellCopySupportSnapshot, useChromeShellSupportSnapshot, useEditor2ValidationFromModel, useEditorChromePublishRailState,
  useHistoryPreviewBlocksForChromeShell,
} from "./contentWorkspaceChromeShellViewModel";
import {
  useContentWorkspaceOpenPublicPage, useContentWorkspacePendingNavigationActions, useContentWorkspaceSectionRailPlacement,
} from "./useContentWorkspaceUiActions";
import { formatDate, normalizeSlug, safeStr } from "./contentWorkspacePresentationSelectors";
import * as EditorK from "./contentWorkspaceEditorConstants";
import { buildWorkspaceImagePrompt, extractWorkspaceBlockText, resolveWorkspaceImagePreset } from "./contentWorkspaceImagePromptShell";
import {
  applyBlockImagePick,
  createRichTextBlockFromLegacyText,
  duplicateBlockInWorkspaceList,
  type BodyParseResult,
} from "./contentWorkspace.blocks";
import { fetchBuildHomeFromRepoIntent } from "./forsideUtils";
import { runWorkspaceAiImageBatch } from "./contentWorkspace.aiRequests";
type ContentWorkspacePageEditorShellModelProps = Omit<Parameters<typeof ContentWorkspacePageEditorShell>[0], "mainView">;

type ContentWorkspaceLegacySidebarModelProps = Parameters<typeof ContentWorkspaceLegacySidebar>[0];

type ContentWorkspaceModalShellModelProps = Parameters<typeof ContentWorkspaceModalShell>[0];

type ContentWorkspaceDebugOverlaysModelProps = Parameters<typeof ContentWorkspaceDevDebugOverlays>[0];

type ContentWorkspaceEditorChromeModelProps = Parameters<typeof ContentWorkspaceEditorChrome>[0];

type ContentWorkspaceAuxiliaryShellModelProps = Parameters<typeof ContentWorkspaceAuxiliaryShell>[0];

type ContentWorkspaceLeftSidebarModelProps = Parameters<typeof LeftSidebar>[0];

type ContentWorkspaceRightPanelModelProps = Omit<Parameters<typeof RightPanel>[0], "workspaceSlot">;

type ContentWorkspaceBodyModelProps = Parameters<typeof WorkspaceBody>[0];

type ContentWorkspacePreviewModelProps = Parameters<typeof WorkspacePreview>[0];

type ContentWorkspaceInspectorModelProps = Parameters<typeof WorkspaceInspector>[0];

type ContentWorkspaceActiveView = ReturnType<typeof useContentWorkspaceShell>["mainView"];

export type ContentWorkspaceProps = {
  initialPageId?: string;
  embedded?: boolean;
  /** Når satt (f.eks. fra vekst-dashboard), velg blokk og scroll til canvas etter lasting */
  initialFocusBlockId?: string;
};

export type ContentWorkspaceShellModel = {
  activeWorkspaceView: ContentWorkspaceActiveView;
  hideLegacySidebar: boolean;
  legacySidebarProps: ContentWorkspaceLegacySidebarModelProps;
  pageEditorShellProps: ContentWorkspacePageEditorShellModelProps;
  showCanonicalEditorSurfaces: boolean;
  editorCanvasRef: RefObject<HTMLElement | null>;
  editorChromeProps: ContentWorkspaceEditorChromeModelProps;
  leftSidebarProps: ContentWorkspaceLeftSidebarModelProps;
  rightPanelProps: ContentWorkspaceRightPanelModelProps;
  workspaceBodyProps: ContentWorkspaceBodyModelProps;
  workspacePreviewProps: ContentWorkspacePreviewModelProps;
  workspaceInspectorProps: ContentWorkspaceInspectorModelProps;
  auxiliaryShellProps: ContentWorkspaceAuxiliaryShellModelProps;
  modalShellProps: ContentWorkspaceModalShellModelProps;
  debugOverlaysProps: ContentWorkspaceDebugOverlaysModelProps;
};

export function useContentWorkspaceShellModel({
  initialPageId,
  embedded = false,
  initialFocusBlockId,
}: ContentWorkspaceProps) {
  const router = useRouter();
  const { push: pushToast } = useToast();
  const [pendingNavigationHref, setPendingNavigationHref] = useState<string | null>(null);
  const hideLegacySidebar = embedded === true;
  const selectedId = safeStr(initialPageId);
  const { isPitch, isWow, isDemo } = useContentWorkspaceUrlModeFlags();
  const hjemSingleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const {
    queryInput,
    setQueryInput,
    query,
    setQuery,
    hjemExpanded,
    setHjemExpanded,
    createPanelOpen,
    setCreatePanelOpen,
    createPanelMode,
    setCreatePanelMode,
    headerVariant,
    setHeaderVariant,
    headerEditConfig,
    setHeaderEditConfig,
    headerEditLoading,
    setHeaderEditLoading,
    headerEditSaving,
    setHeaderEditSaving,
    headerEditError,
    setHeaderEditError,
    hideMainNavigation,
    setHideMainNavigation,
    hideSecondaryNavigation,
    setHideSecondaryNavigation,
    hideFooterNavigation,
    setHideFooterNavigation,
    hideMemberNavigation,
    setHideMemberNavigation,
    hideCtaNavigation,
    setHideCtaNavigation,
    hideLanguageNavigation,
    setHideLanguageNavigation,
    multilingualMode,
    setMultilingualMode,
    colorsContentBg,
    setColorsContentBg,
    colorsButtonBg,
    setColorsButtonBg,
    colorsButtonText,
    setColorsButtonText,
    colorsButtonBorder,
    setColorsButtonBorder,
    labelColors,
    setLabelColors,
    contentDirection,
    setContentDirection,
    emailPlatform,
    setEmailPlatform,
    captchaVersion,
    setCaptchaVersion,
    notificationEnabled,
    setNotificationEnabled,
    mediaPickerOpen,
    setMediaPickerOpen,
    mediaPickerTarget,
    setMediaPickerTarget,
  } = useContentWorkspacePresentationState();
  const {
    mainView,
    setMainView,
    globalPanelTab,
    setGlobalPanelTab,
    globalSubView,
    setGlobalSubView,
    goToGlobalWorkspace,
    goToDesignWorkspace,
    openGlobalSubViewCard,
    exitGlobalSubView,
  } = useContentWorkspaceShell();
  const [createTitle, setCreateTitle] = useState("");
  const [createSlug, setCreateSlug] = useState("");
  const [createSlugTouched, setCreateSlugTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  /** Umbraco Core Patch A: chosen child DocumentType alias when creating. */
  const [createDocumentTypeAlias, setCreateDocumentTypeAlias] = useState<string | null>(null);
  /** Allowed child types from parent's DocumentType (fetched when create panel opens). */
  const [allowedChildTypes, setAllowedChildTypes] = useState<string[]>([]);
  const [createParentLoading, setCreateParentLoading] = useState(false);
  /** Historikk » Forhåndsvis: live preview only; does not change editor blocks or DB. */
  const [historyVersionPreview, setHistoryVersionPreview] = useState<HistoryPreviewPayload | null>(null);
  const editorCanvasRef = useRef<HTMLElement | null>(null);
  const [page, setPage] = useState<ContentPage | null>(null);
  const [buildHomeFromRepoBusy, setBuildHomeFromRepoBusy] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  /** Umbraco Core Patch A: DocumentType binding (body envelope when no DB column). */
  const [documentTypeAlias, setDocumentTypeAlias] = useState<string | null>(null);
  const [invariantEnvelopeFields, setInvariantEnvelopeFields] = useState<Record<string, unknown>>({});
  const invariantEnvelopeMirrorRef = useRef<Record<string, unknown>>({});
  const lastLoadedDetailPageIdRef = useRef<string | null>(null);
  useEffect(() => {
    invariantEnvelopeMirrorRef.current = invariantEnvelopeFields;
  }, [invariantEnvelopeFields]);
  const [cultureEnvelopeFields, setCultureEnvelopeFields] = useState<Record<string, unknown>>({});
  const [editorLocale, setEditorLocale] = useState<string>(() => {
    if (typeof window === "undefined") return "nb";
    try {
      const s = window.sessionStorage.getItem("lp_cms_editor_locale");
      return s === "en" ? "en" : "nb";
    } catch {
      return "nb";
    }
  });
  const clearEnvelopeScalarLayers = useCallback(() => {
    setInvariantEnvelopeFields({});
    setCultureEnvelopeFields({});
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem("lp_cms_editor_locale", editorLocale === "en" ? "en" : "nb");
    } catch {
      /* ignore */
    }
  }, [editorLocale]);
  const [editOpen, setEditOpen] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  /** Block edit modal draft merged into live preview (no save). */
  const [editModalLiveBlock, setEditModalLiveBlock] = useState<EditableBlock | null>(null);
  /** Brief highlight after duplicate (micro-feedback). */
  const [blockPulseId, setBlockPulseId] = useState<string | null>(null);
  const blockPulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** WOW before/after — drives displayBlocks for canvas + inspector. */
  const [originalBlocks, setOriginalBlocks] = useState<Block[] | null>(null);
  const [showAfter, setShowAfter] = useState(false);
  const [newBlockAnimationIds, setNewBlockAnimationIds] = useState<Set<string>>(() => new Set());
  const queueBlockEnterAnimation = useCallback((id: string) => {
    setNewBlockAnimationIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    window.setTimeout(() => {
      setNewBlockAnimationIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 420);
  }, []);
  const postAddBlockRef = useRef<(block: Block) => void>(() => {});
  const onAfterAddBlock = useCallback((block: Block) => {
    postAddBlockRef.current(block);
  }, []);
  const {
    bodyMode,
    setBodyMode,
    blocks,
    setBlocks,
    meta,
    setMeta,
    legacyBodyText,
    setLegacyBodyText,
    invalidBodyRaw,
    setInvalidBodyRaw,
    bodyParseError,
    setBodyParseError,
    bodyForSave,
    applyParsedBody: applyParsedBodyCore,
    setBlockById,
    onMoveBlock,
    onDeleteBlock: deleteBlockCore,
  } = useContentWorkspaceBlocks({
    documentTypeAlias,
    invariantEnvelopeFields,
    cultureEnvelopeFields,
    onAfterAddBlock,
  });
  const blockEditorDataTypesCtx = useBlockEditorDataTypesMergedOptional();
  const mergedBlockEditorDataTypes = blockEditorDataTypesCtx?.data?.merged ?? null;
  const documentTypeDefinitionsCtx = useDocumentTypeDefinitionsMergedOptional();
  const mergedDocumentTypeDefinitions = documentTypeDefinitionsCtx?.data?.merged ?? null;
  const blockEditorDataTypeResolved = useMemo(
    () => getBlockEditorDataTypeForDocument(documentTypeAlias, mergedBlockEditorDataTypes, mergedDocumentTypeDefinitions),
    [documentTypeAlias, mergedBlockEditorDataTypes, mergedDocumentTypeDefinitions],
  );
  const resolvedDocumentTypeForCanvas = useMemo(() => {
    const a = documentTypeAlias?.trim();
    if (!a) return null;
    return mergedDocumentTypeDefinitions?.[a] ?? getBaselineDocumentTypeDefinition(a) ?? null;
  }, [documentTypeAlias, mergedDocumentTypeDefinitions]);
  const bodyPropertyForCanvas = useMemo(() => {
    if (!resolvedDocumentTypeForCanvas) return null;
    return resolvedDocumentTypeForCanvas.properties.find((p) => p.alias === "body") ?? null;
  }, [resolvedDocumentTypeForCanvas]);
  const bodyGroupForCanvas = useMemo(() => {
    if (!resolvedDocumentTypeForCanvas || !bodyPropertyForCanvas) return null;
    return resolvedDocumentTypeForCanvas.groups.find((g) => g.id === bodyPropertyForCanvas.groupId) ?? null;
  }, [resolvedDocumentTypeForCanvas, bodyPropertyForCanvas]);
  const blockListCreateLabel = blockEditorDataTypeResolved?.createButtonLabel ?? "Legg til innhold";
  const blockListAddDisabled =
    bodyMode === "blocks" &&
    !canAddBlockForDataType(documentTypeAlias, blocks.length, mergedBlockEditorDataTypes, mergedDocumentTypeDefinitions);
  const blockPropertyDataTypeAlias = blockEditorDataTypeResolved?.alias ?? null;
  /**
   * U82B: Read-only canvas projection (WOW «før» / historikk). Canonical editable list is always `blocks`
   * from useContentWorkspaceBlocks — save, dirty, inspector fields, and setBlockById target that list only.
   */
  const displayBlocks = useMemo(
    () => (isWow && !showAfter && Array.isArray(originalBlocks) ? originalBlocks : blocks),
    [isWow, showAfter, originalBlocks, blocks],
  );
  const {
    selectedBlockId,
    setSelectedBlockId,
    hoverBlockId,
    setHoverBlockId,
    showPreviewColumn,
    setShowPreviewColumn,
    previewLayoutMode,
    setPreviewLayoutMode,
    canvasMode,
    setCanvasMode,
    previewDevice,
    setPreviewDevice,
    inspectorSection,
    setInspectorSection,
    showBlocks,
    showPreview,
    selectedBlock,
    selectedBlockForInspector,
    selectedBlockIndex,
    onSelectBlockFromTree,
    onDeleteBlock,
  } = useContentWorkspaceUi({
    blocks,
    displayBlocks,
    bodyMode,
    editorCanvasRef,
    deleteBlockCore,
  });

  useLayoutEffect(() => {
    postAddBlockRef.current = (block: Block) => {
      queueBlockEnterAnimation(block.id);
      setSelectedBlockId(block.id);
    };
  }, [queueBlockEnterAnimation, setSelectedBlockId]);

  const applyParsedBody = useCallback(
    (parsed: BodyParseResult) => {
      applyParsedBodyCore(parsed);
      queueMicrotask(() => {
        if (parsed.mode === "blocks") setSelectedBlockId(parsed.blocks[0]?.id ?? null);
        else setSelectedBlockId(null);
      });
    },
    [applyParsedBodyCore, setSelectedBlockId],
  );
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiSuggestLoading, setAiSuggestLoading] = useState(false);
  const [aiScore, setAiScore] = useState<number | null>(null);
  const [aiHints, setAiHints] = useState<string[]>([]);
  const [aiBuildLoading, setAiBuildLoading] = useState(false);
  const [aiBuildResult, setAiBuildResult] = useState<any[] | null>(null);
  const [aiProduct, setAiProduct] = useState("");
  const [aiAudience, setAiAudience] = useState("");
  const [aiIntent, setAiIntent] = useState("");
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [aiBatchLoading, setAiBatchLoading] = useState(false);
  const [aiBatchProgress, setAiBatchProgress] = useState({
    total: 0,
    done: 0,
  });
  /** Prevents overlapping block-level AI calls (improve / image / batch). */
  const [actionLock, setActionLock] = useState(false);
  /** Loaded from GET /api/auth/me — required by POST /api/ai/block (companyId + userId). */
  const [aiBlockRunContext, setAiBlockRunContext] = useState<{ userId: string; companyId: string } | null>(null);
  /** Role for gating superadmin-only CMS tools (e.g. AI Control Tower). */
  const [cmsEditorRole, setCmsEditorRole] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
        const json: unknown = await res.json().catch(() => null);
        if (cancelled || !json || typeof json !== "object") return;
        const root = json as { ok?: unknown; data?: unknown };
        if (root.ok !== true || root.data == null || typeof root.data !== "object") return;
        const data = root.data as { user?: unknown };
        const u = data.user != null && typeof data.user === "object" ? (data.user as Record<string, unknown>) : null;
        if (!u) return;
        const userId = typeof u.id === "string" ? u.id.trim() : "";
        const profileCompany = typeof u.companyId === "string" ? u.companyId.trim() : "";
        const runnerCompany = typeof u.aiRunnerCompanyId === "string" ? u.aiRunnerCompanyId.trim() : "";
        const companyId = profileCompany || runnerCompany;
        const role = typeof u.role === "string" ? u.role.trim() : null;
        if (role) setCmsEditorRole(role);
        if (userId && companyId) setAiBlockRunContext({ userId, companyId });
      } catch {
        /* fail-closed: block AI until /api/auth/me returns both ids */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  /** Client-side counters for block-level AI (dev panel; no external services). */
  const [metrics, setMetrics] = useState({ actions: 0, errors: 0 });
  const bumpMetricsError = useCallback(() => {
    setMetrics((m) => ({ ...m, errors: m.errors + 1 }));
  }, []);
  const bumpMetricsAction = useCallback(() => {
    setMetrics((m) => ({ ...m, actions: m.actions + 1 }));
  }, []);
  const [aiImages, setAiImages] = useState<Array<{ url: string; assetId?: string }> | null>(null);
  const [imagePreset, setImagePreset] = useState<string>("office");
  const [aiAudit, setAiAudit] = useState<{
    score: number;
    issues: string[];
  } | null>(null);
  const [aiAuditLoading, setAiAuditLoading] = useState(false);
  const [pitchStep, setPitchStep] = useState(1);
  const wowHasRunRef = useRef(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const aiAnyLoading = aiLoading || aiBuildLoading || aiAuditLoading || aiImageLoading || aiBatchLoading || aiSuggestLoading;
  const aiCacheRef = useRef<Record<string, string>>({});
  const isDev = process.env.NODE_ENV !== "production";
  /** Block List Editor 2.0 – feature flag (local, no backend). When true, render Editor2Shell. */
  const useEditor2 = false;
  const [editor2Model, setEditor2Model] = useState<BlockList | null>(null);
  const [editor2SelectedBlockId, setEditor2SelectedBlockId] = useState<string | null>(null);
  const [editor2FocusNonce, setEditor2FocusNonce] = useState(0);
  const [editor2ResetSearchNonce, setEditor2ResetSearchNonce] = useState(0);
  const editor2BlockListRef = useRef<HTMLDivElement | null>(null);
  const editor2PendingFocusIdRef = useRef<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  function setSaveStateSafe(next: SaveState): void {
    setSaveState((current) => {
      switch (current) {
        case "idle":
          if (next !== "dirty" && next !== "offline") return current;
          break;
        case "dirty":
          if (next !== "saving" && next !== "offline" && next !== "idle") return current;
          break;
        case "saving":
          if (next !== "saved" && next !== "conflict" && next !== "error" && next !== "offline") return current;
          break;
        case "saved":
          if (next !== "dirty" && next !== "idle") return current;
          break;
        case "offline":
          if (next !== "dirty" && next !== "conflict" && next !== "idle") return current;
          break;
        case "conflict":
          if (next !== "idle") return current;
          break;
        case "error":
          if (next !== "dirty" && next !== "saving" && next !== "idle") return current;
          break;
      }
      return next;
    });
  }
  const [lastServerUpdatedAt, setLastServerUpdatedAt] = useState<string | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [recoveryBannerVisible, setRecoveryBannerVisible] = useState(false);
  const [outboxData, setOutboxData] = useState<OutboxEntry | null>(null);
  const [outboxDetailsExpanded, setOutboxDetailsExpanded] = useState(false);
  // E1 – outbox copy feedback per item (item-scoped)
  const [outboxCopyFeedback, setOutboxCopyFeedback] = useState<Record<string, "ok" | "fail" | null>>({});
  // I4 – session rid (én per session, settes ved første behov)
  const sessionRidRef = useRef<string | null>(null);
  const [supportCopyFeedback, setSupportCopyFeedback] = useState<"ok" | "fail" | null>(null); // I4
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outboxWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  /** Skip scheduling autosave once after initial load so we don't trigger 409 on open. */
  const skipNextAutosaveScheduleRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const performSaveRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));
  const saveSeqRef = useRef<number>(0);
  const activeAbortRef = useRef<AbortController | null>(null);
  const statusSeqRef = useRef<number>(0);
  const statusAbortRef = useRef<AbortController | null>(null);
  const statusInProgressRef = useRef(false);
  const [isStatusInProgress, setIsStatusInProgress] = useState(false);
  const currentSnapshot = useMemo(
    () => makeSnapshot({ title, slug, body: bodyForSave }),
    [title, slug, bodyForSave]
  );
  const dirty = useMemo(() => {
    if (!selectedId || !page || !savedSnapshot) return false;
    return currentSnapshot !== savedSnapshot;
  }, [selectedId, page, savedSnapshot, currentSnapshot]);
  const clearAutosaveTimer = useCallback(() => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
  }, []);
  const { cancelPendingNavigation, confirmPendingNavigation } = useContentWorkspacePendingNavigationActions(
    pendingNavigationHref,
    setPendingNavigationHref,
    clearAutosaveTimer,
    router,
  );
  const {
    items,
    listLoading,
    listError,
    listReloadKey,
    setListReloadKey,
    detailLoading,
    detailError,
    pageNotFound,
    refetchDetailKey,
    setRefetchDetailKey,
    updateSidebarItem,
    guardPush,
    selectContentPage,
    reloadDetailFromServer,
  } = useContentWorkspaceData({
    query,
    selectedId,
    setPage,
    editorLocale,
    mergedDocumentTypeDefinitions,
    invariantEnvelopeMirrorRef,
    lastLoadedDetailPageIdRef,
    navigation: {
      router,
      routeSelectedId: selectedId,
      loadedPage: page,
      dirty,
      isOffline,
      clearAutosaveTimer,
      setPendingNavigationHref,
      setMainView,
    },
    editorSync: {
      setPage,
      setTitle,
      setSlug,
      setSlugTouched,
      setDocumentTypeAlias,
      setInvariantEnvelopeFields,
      setCultureEnvelopeFields,
      applyParsedBody,
      setLastServerUpdatedAt,
      setSaveStateSafe,
      setLastError,
      setLastSavedAt,
      setSavedSnapshot,
      skipNextAutosaveScheduleRef,
      setOutboxData,
      setRecoveryBannerVisible,
      setBodyMode,
      setBlocks,
      setMeta,
      setLegacyBodyText,
      setInvalidBodyRaw,
      setBodyParseError,
      setSelectedBlockId,
    },
    routeUi: {
      initialFocusBlockId,
      blocks,
      setSelectedBlockId,
      onRoutePageIdChange: () => setHistoryVersionPreview(null),
    },
  });
  const isContentTab =
    (mainView === "content" || mainView === "preview") &&
    Boolean(
      page &&
        selectedId &&
        !pageNotFound &&
        !detailLoading &&
        !detailError &&
        saveState !== "conflict",
    );
  /** Resolved page id for API calls; when URL is slug we use page.id after load. */
  const effectiveId = page?.id ?? selectedId;
  const onApplySuggestPatch = useCallback(
    (editorBlocks: EditorBlockForPatch, mergedMeta: Record<string, unknown>) => {
      applyParsedBody(parseBodyToBlocks({ blocks: editorBlocks, meta: mergedMeta }));
    },
    [applyParsedBody]
  );
  const onMergeDiagnostics = useCallback(
    (contract: Partial<PageAiContract>) => {
      setMeta((prev) => mergeContractIntoMeta(prev, contract));
    },
    [setMeta]
  );
  const workspaceAi = useContentWorkspaceAi({
    effectiveId,
    selectedId,
    blocks,
    meta,
    title,
    slug,
    documentTypeAlias,
    onApplySuggestPatch,
    onMergeDiagnostics,
  });
  const {
    aiBusyToolId,
    aiError,
    setAiError,
    aiSummary,
    setAiSummary,
    aiBlockBuilderResult,
    setAiBlockBuilderResult,
    aiScreenshotBuilderResult,
    setAiScreenshotBuilderResult,
    lastGeneratedImageResult,
    aiLastAppliedTool,
    setAiLastAppliedTool,
    aiLastActionFeature,
    setAiLastActionFeature,
    aiCapability,
    diagnosticsResult,
    diagnosticsBusy,
    aiHistory,
    reportAiError,
    pushAiHistory,
    runFullDiagnostics,
    handleAiImprovePage,
    handleAiSeoOptimize,
    handleAiGenerateSections,
    handleAiStructuredIntent,
    handleAiImageGenerate,
    handleAiImageImproveMetadata,
    handleLayoutSuggestions,
    handleApplyDesignSuggestion,
    handleDismissDesignSuggestion,
    handleBlockBuilder,
    handleScreenshotBuilder,
    lastLayoutSuggestionsResult,
  } = workspaceAi;
  const richTextTransport = useContentWorkspaceRichTextTransport({
    effectiveId,
    title,
    blocks,
    setBlockById,
  });
  const {
    richTextInline,
    setRichTextInline,
    richTextInlineRef,
    richTextDirectAiBusy,
    setRichTextDirectAiBusy,
    inlineAbortRef,
    continueRewriteAbortRef,
    inlineBodyRunRef,
    inlineBodyDebounceRef,
    fetchRichTextInlineBody,
    runRichTextContinueAtCursor,
    runRichTextRewriteSelection,
  } = richTextTransport;
  const panelAi = useContentWorkspacePanelRequests({
    effectiveId,
    showBlocks,
    isContentTab,
    cmsEditorRole,
    selectedBlockId,
    setSelectedBlockId,
    title,
    slug,
    page,
    blocks,
    displayBlocks,
    setBlocks,
    setTitle,
    setSaveStateSafe,
    isWow,
    showAfter,
    originalBlocks,
    setOriginalBlocks,
  });
  const {
    copilotBusy,
    copilotError,
    visibleCopilotSuggestions,
    onCopilotApply,
    onCopilotDismiss,
    designScore,
    designIssues,
    designSuggestions,
    designPreviewBlocks,
    designPreviewSuggestionLines,
    designPanelBusy,
    designPanelError,
    designPanelEnabled,
    controlTowerEnabled,
    onDesignAnalyze,
    onDesignImprove,
    onDesignApplyPreview,
    onDesignDiscardPreview,
    growthPanelEnabled,
    growthProductInput,
    setGrowthProductInput,
    growthAudienceInput,
    setGrowthAudienceInput,
    growthSeoOpportunities,
    growthSeoKeywords,
    growthContentIdeas,
    growthAdHeadlines,
    growthAdDescriptions,
    growthFunnelSteps,
    growthFunnelImprovements,
    growthBusy,
    growthError,
    onGrowthClearPreview,
    onGrowthRunSeo,
    onGrowthRunAds,
    onGrowthRunFunnel,
    autonomyPanelEnabled,
    autonomyBusy,
    autonomyError,
    autonomyMetrics,
    autonomyInsights,
    autonomyDecisionRow,
    autonomyAutomationText,
    onAutonomyRefreshDashboard,
    onAutonomyPreviewAutomation,
    onAutonomyApproveExecute,
    aiFullPageModalOpen,
    setAiFullPageModalOpen,
    aiFullPageModalPrompt,
    setAiFullPageModalPrompt,
    aiFullPageBusy,
    aiFullPageError,
    setAiFullPageError,
    aiFullPagePreview,
    setAiFullPagePreview,
    aiFullPageReplaceOk,
    setAiFullPageReplaceOk,
    aiFullPageAlsoTitle,
    setAiFullPageAlsoTitle,
    aiFullPagePreviewBlocks,
    closeAiFullPageModal,
    onAiFullPageModalGenerate,
    onAiFullPageModalApply,
  } = panelAi;
  const {
    contentSettingsTab,
    setContentSettingsTab,
    navigationTab,
    setNavigationTab,
    footerTab,
    setFooterTab,
    designTab,
    setDesignTab,
    editorCmsMenuDraft,
    setEditorCmsMenuDraft,
    invalidBodyResetConfirmOpen,
    requestInvalidBodyResetConfirm,
    closeInvalidBodyResetConfirm,
    blockPickerOpen,
    setBlockPickerOpen,
    addInsertIndexRef,
  } = useContentWorkspaceOverlays({ effectiveId, selectedId, bodyMode });

  const onNavigateToGlobalDesignSettings = useCallback(() => {
    goToGlobalWorkspace();
    setGlobalSubView("content-and-settings");
    setContentSettingsTab("general");
  }, [goToGlobalWorkspace, setGlobalSubView, setContentSettingsTab]);

  const [cmsAiLayoutBusy, setCmsAiLayoutBusy] = useState(false);
  const [cmsAiPageBusy, setCmsAiPageBusy] = useState(false);
  const [aiAbExperimentBusy, setAiAbExperimentBusy] = useState(false);
  const [aiAbExperimentNote, setAiAbExperimentNote] = useState<string | null>(null);
  const [cmsAiImageBusyBlockId, setCmsAiImageBusyBlockId] = useState<string | null>(null);
  const [cmsAiMultimodalPrompt, setCmsAiMultimodalPrompt] = useState("");
  const [cmsAiImagePromptByBlockId, setCmsAiImagePromptByBlockId] = useState<Record<string, string>>({});
  useEffect(() => {
    setSelectedBlockId(null);
    setAiSuggestion(null);
    setAiScore(null);
    setCmsAiLayoutBusy(false);
    setCmsAiPageBusy(false);
    setCmsAiImageBusyBlockId(null);
    setCmsAiMultimodalPrompt("");
    setCmsAiImagePromptByBlockId({});
    setPendingNavigationHref(null);
    setBlockPulseId(null);
    if (blockPulseTimerRef.current) {
      clearTimeout(blockPulseTimerRef.current);
      blockPulseTimerRef.current = null;
    }
  }, [effectiveId]);
  // Left-rail extension: lets this editor populate the existing sidebar slot in the section wrapper.
  const setSectionSidebarContent = useSectionSidebarContent();
  useEffect(() => {
    return () => {
      setSectionSidebarContent?.({ key: "editor-rail-empty", node: null });
    };
  }, [setSectionSidebarContent]);
  useContentWorkspaceSectionRailPlacement(setSectionSidebarContent, effectiveId);
  const publishRail = useEditorChromePublishRailState({
    page,
    slug,
    saveState,
    dirty,
    isOffline,
    lastSavedAt,
    lastError,
    isDemo,
    selectedId,
    detailLoading,
    isStatusInProgress,
    title,
    blocks,
  });
  const { statusLabel, isPublished, isDraft, saving, hasConflict, canSave, canPublish, canUnpublish, publicSlug, canOpenPublic, publishDisabledTitle, unpublishDisabledTitle, statusLine, publishReadiness } =
    publishRail;
  const onOpenPublicPage = useContentWorkspaceOpenPublicPage(publicSlug);
  // Block List Editor 2.0 – parse body to BlockList when useEditor2 and page available (read-only adapter)
  useEffect(() => {
    if (!useEditor2 || !page) return;
    const result = tryParseBlockListFromBody(page.body);
    setEditor2Model(result.ok ? result.list : { version: 1, blocks: [] });
  }, [useEditor2, page]);
  const editor2Validation = useEditor2ValidationFromModel(editor2Model);
  // Step 2.4 – soft-mode: bump focusNonce only when selection came from list (pendingFocusIdRef)
  useEffect(() => {
    if (!useEditor2 || !editor2SelectedBlockId) return;
    if (editor2PendingFocusIdRef.current !== editor2SelectedBlockId) return;
    editor2PendingFocusIdRef.current = null;
    const errs = editor2Validation.byId[editor2SelectedBlockId] ?? [];
    const hasFieldErrors = errs.some((e) => /^[a-zA-Z0-9_]+:/.test(e));
    if (hasFieldErrors) setEditor2FocusNonce((n) => n + 1);
  }, [useEditor2, editor2SelectedBlockId, editor2Validation.byId]);
  // Step 2.9 – global Ctrl/Cmd+F when Editor2 active: focus BlockListPane and reset search
  useEffect(() => {
    if (!useEditor2) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setEditor2ResetSearchNonce((n) => n + 1);
        editor2BlockListRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [useEditor2]);
  const supportSnapshot = useChromeShellSupportSnapshot(
    statusLine.key,
    selectedId,
    page?.slug,
    isOffline,
    sessionRidRef,
  );
  const copySupportSnapshot = useChromeShellCopySupportSnapshot(supportSnapshot, setSupportCopyFeedback);
  const { performSave, saveDraft, onSetStatus } = useContentWorkspacePersistence({
    effectiveId,
    selectedId,
    page,
    pageNotFound,
    detailError,
    isOffline,
    isDemo,
    title,
    slug,
    bodyForSave,
    lastServerUpdatedAt,
    saveState,
    dirty,
    refs: {
      saveSeqRef,
      activeAbortRef,
      pendingSaveRef,
      performSaveRef,
      statusSeqRef,
      statusAbortRef,
      statusInProgressRef,
      savingRef,
    },
    setPage,
    setTitle,
    setSlug,
    setSlugTouched,
    applyParsedBody,
    setSavedSnapshot,
    setLastSavedAt,
    setLastError,
    setLastServerUpdatedAt,
    setSaveStateSafe,
    setOutboxData,
    setIsStatusInProgress,
    updateSidebarItem,
    clearAutosaveTimer,
    router,
    pushToast,
    documentTypeAlias,
    blockCountForSave: blocks.length,
    mergedBlockEditorDataTypes,
    mergedDocumentTypeDefinitions,
    editorLocale,
    setInvariantEnvelopeFields,
    setCultureEnvelopeFields,
  });
  const currentServerFingerprint = useMemo(() => {
    if (!page) return null;
    const snapshotPayload = snapshotBodyFromPageBody(page.body);
    const bodyStr =
      typeof snapshotPayload === "string" ? snapshotPayload : JSON.stringify(snapshotPayload);
    const draft: OutboxDraft = { title: page.title, slug: page.slug, status: page.status, body: bodyStr };
    return fingerprintOutboxDraft(draft);
  }, [page]);
  const hasFingerprintConflict = useMemo(
    () => Boolean(outboxData && currentServerFingerprint != null && outboxData.fingerprint !== currentServerFingerprint),
    [outboxData, currentServerFingerprint]
  );
  const onRestoreOutbox = useCallback(() => {
    if (hasFingerprintConflict) return;
    const entry = outboxData;
    if (!entry) return;
    setTitle(entry.draft.title);
    setSlug(entry.draft.slug);
    setSlugTouched(true);
    applyParsedBody(parseBodyToBlocks(entry.draft.body));
    setSaveStateSafe("dirty");
    setRecoveryBannerVisible(false);
  }, [hasFingerprintConflict, outboxData, applyParsedBody]);
  const onDiscardOutbox = useCallback(() => {
    if (outboxData) clearOutbox(outboxData.pageId);
    setOutboxData(null);
    setRecoveryBannerVisible(false);
    setOutboxDetailsExpanded(false);
  }, [outboxData]);
  // E1 – outbox copy/export (sanitert: `contentWorkspace.outbox.ts`)
  const copyOutboxSafetyExport = useCallback(
    async (entry: OutboxEntry) => {
      await copyOutboxSafetyExportToClipboard(entry, sessionRidRef, isOffline, setOutboxCopyFeedback);
    },
    [isOffline, setOutboxCopyFeedback]
  );
  const onSave = useCallback(async () => {
    if (aiLastActionFeature && effectiveId) {
      logEditorAiEvent({
        type: "ai_save_after_action",
        pageId: effectiveId,
        variantId: null,
        feature: aiLastActionFeature,
        timestamp: new Date().toISOString(),
      });
      setAiLastActionFeature(null);
    }
    await saveDraft("manual");
  }, [saveDraft, aiLastActionFeature, effectiveId]);
  const onSaveAndPreview = async () => {
    if (canSave) await onSave();
    if (selectedId && typeof window !== "undefined") {
      window.open(`${window.location.origin}${backofficePreviewPath(selectedId)}`, "_blank", "noopener");
    }
  };
  const bellissimaActionsRef = useRef({
    onSave,
    onSetStatus,
  });
  useEffect(() => {
    bellissimaActionsRef.current = {
      onSave,
      onSetStatus,
    };
  }, [onSave, onSetStatus]);
  const bellissimaActionHandlers = useMemo(
    () => ({
      save: () => void bellissimaActionsRef.current.onSave(),
      publish: () => void bellissimaActionsRef.current.onSetStatus("published"),
      unpublish: () => void bellissimaActionsRef.current.onSetStatus("draft"),
    }),
    []
  );
  const bellissimaSnapshot = useContentWorkspaceBellissima({
    effectiveId,
    page,
    pageNotFound,
    detailError,
    detailLoading,
    title,
    slug,
    documentTypeAlias,
    statusLabel,
    canvasMode,
    saveState,
    dirty,
    canSave,
    canPublish,
    canUnpublish,
    canOpenPublic,
    activeWorkspaceView: mainView,
    actionHandlers: bellissimaActionHandlers,
  });
  const visualPatchPendingRef = useRef<Record<string, Record<string, unknown>>>({});
  const visualPatchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushVisualCanvasPatches = useCallback(() => {
    const pending = visualPatchPendingRef.current;
    if (Object.keys(pending).length === 0) return;
    visualPatchPendingRef.current = {};
    for (const [blockId, patch] of Object.entries(pending)) {
      if (!patch || Object.keys(patch).length === 0) continue;
      setBlockById(blockId, (c) => mergeVisualInlinePatchIntoBlock(c, patch));
    }
  }, [setBlockById]);
  useEffect(() => {
    return () => {
      if (visualPatchTimerRef.current) {
        clearTimeout(visualPatchTimerRef.current);
        visualPatchTimerRef.current = null;
      }
      flushVisualCanvasPatches();
    };
  }, [flushVisualCanvasPatches]);
  useEffect(() => {
    flushVisualCanvasPatches();
  }, [selectedBlockId, flushVisualCanvasPatches]);
  const appendSerializedAiBlocks = useCallback((rawBlocks: unknown[]) => {
    const next: Block[] = [];
    for (const r of rawBlocks) {
      const b = mapSerializedAiBlockToBlock(r);
      if (b) next.push(b);
    }
    if (next.length === 0) return false;
    setBlocks((prev) => [...prev, ...next]);
    return true;
  }, []);
  const materializeAiBlocks = useCallback((rawBlocks: unknown[]) => {
    const next: Block[] = [];
    for (const raw of rawBlocks) {
      const mapped = mapSerializedAiBlockToBlock(raw);
      if (mapped) {
        next.push(mapped);
        continue;
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
      const obj = raw as Record<string, unknown>;
      const type = typeof obj.type === "string" ? obj.type : "";
      const data =
        obj.data != null && typeof obj.data === "object" && !Array.isArray(obj.data)
          ? (obj.data as Record<string, unknown>)
          : null;
      if (!type || !data) continue;
      const normalized = normalizeBlock({
        id: typeof obj.id === "string" ? obj.id : undefined,
        type,
        ...data,
      });
      if (normalized) next.push(normalized);
    }
    return next;
  }, []);
  const insertBlocksAfterSelection = useCallback(
    (nextBlocks: Block[]) => {
      if (nextBlocks.length === 0) return false;
      setBlocks((prev) => {
        const copy = [...prev];
        const selectedIndex = selectedBlockId
          ? copy.findIndex((block) => block.id === selectedBlockId)
          : -1;
        const insertAt = selectedIndex >= 0 ? selectedIndex + 1 : copy.length;
        copy.splice(insertAt, 0, ...nextBlocks);
        return copy;
      });
      return true;
    },
    [selectedBlockId],
  );
  const onClearError = useCallback(() => {
    setAiError(null);
  }, [setAiError]);
  const onRunDiagnostics = useCallback(async () => {
    await runFullDiagnostics();
  }, [runFullDiagnostics]);
  const onBlockBuilderInsert = useCallback(() => {
    const nextBlocks = aiBlockBuilderResult
      ? materializeAiBlocks([aiBlockBuilderResult.block])
      : [];
    if (nextBlocks.length === 0) {
      reportAiError("Kunne ikke sette inn blokken. Resultatet matchet ikke sidemodellen.", {
        kind: "parse",
        feature: "block_builder",
      });
      return;
    }
    if (!insertBlocksAfterSelection(nextBlocks)) {
      return;
    }
    nextBlocks.forEach((block) => queueBlockEnterAnimation(block.id));
    setSaveStateSafe("dirty");
    setSelectedBlockId(nextBlocks[0].id);
    setAiSummary(aiBlockBuilderResult?.message || "Blokken ble satt inn i editoren.");
    setAiLastAppliedTool("block.builder");
    setAiLastActionFeature("block_builder");
    pushAiHistory("block.builder", "AI Block Builder", "Satt inn blokk");
    setAiBlockBuilderResult(null);
  }, [
    aiBlockBuilderResult,
    insertBlocksAfterSelection,
    materializeAiBlocks,
    pushAiHistory,
    queueBlockEnterAnimation,
    reportAiError,
    setAiBlockBuilderResult,
    setAiLastActionFeature,
    setAiLastAppliedTool,
    setAiSummary,
    setSaveStateSafe,
    setSelectedBlockId,
  ]);
  const onScreenshotBuilderReplace = useCallback(() => {
    const nextBlocks = materializeAiBlocks(aiScreenshotBuilderResult?.blocks ?? []);
    if (nextBlocks.length === 0) {
      reportAiError("Ingen gyldige blokker kunne brukes fra referansen.", {
        kind: "parse",
        feature: "screenshot_builder",
      });
      return;
    }
    setBlocks(nextBlocks);
    nextBlocks.forEach((block) => queueBlockEnterAnimation(block.id));
    setSaveStateSafe("dirty");
    setSelectedBlockId(nextBlocks[0].id);
    setAiSummary(
      aiScreenshotBuilderResult?.message || `Erstattet innhold med ${nextBlocks.length} AI-blokker.`,
    );
    setAiLastAppliedTool("screenshot.builder");
    setAiLastActionFeature("screenshot_builder");
    pushAiHistory("screenshot.builder", "Screenshot / referanse", "Erstattet innhold");
    setAiScreenshotBuilderResult(null);
  }, [
    aiScreenshotBuilderResult,
    materializeAiBlocks,
    pushAiHistory,
    queueBlockEnterAnimation,
    reportAiError,
    setAiLastActionFeature,
    setAiLastAppliedTool,
    setAiScreenshotBuilderResult,
    setAiSummary,
    setBlocks,
    setSaveStateSafe,
    setSelectedBlockId,
  ]);
  const onScreenshotBuilderAppend = useCallback(() => {
    const nextBlocks = materializeAiBlocks(aiScreenshotBuilderResult?.blocks ?? []);
    if (nextBlocks.length === 0) {
      reportAiError("Ingen gyldige blokker kunne legges til fra referansen.", {
        kind: "parse",
        feature: "screenshot_builder",
      });
      return;
    }
    if (!insertBlocksAfterSelection(nextBlocks)) {
      return;
    }
    nextBlocks.forEach((block) => queueBlockEnterAnimation(block.id));
    setSaveStateSafe("dirty");
    setSelectedBlockId(nextBlocks[0].id);
    setAiSummary(
      aiScreenshotBuilderResult?.message || `La til ${nextBlocks.length} AI-blokker fra referanse.`,
    );
    setAiLastAppliedTool("screenshot.builder");
    setAiLastActionFeature("screenshot_builder");
    pushAiHistory("screenshot.builder", "Screenshot / referanse", "La til blokker");
    setAiScreenshotBuilderResult(null);
  }, [
    aiScreenshotBuilderResult,
    insertBlocksAfterSelection,
    materializeAiBlocks,
    pushAiHistory,
    queueBlockEnterAnimation,
    reportAiError,
    setAiLastActionFeature,
    setAiLastAppliedTool,
    setAiScreenshotBuilderResult,
    setAiSummary,
    setSaveStateSafe,
    setSelectedBlockId,
  ]);
  const onCmsAiGenerateLayout = useCallback(
    async (promptRaw: string) => {
      const prompt = String(promptRaw ?? "").trim();
      if (!prompt) return;
      setCmsAiLayoutBusy(true);
      try {
        const res = await fetch("/api/ai/layout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const json = (await res.json()) as { ok?: boolean; data?: { blocks?: unknown[] } };
        if (!res.ok || json.ok === false) return;
        const blocks = Array.isArray(json.data?.blocks) ? json.data!.blocks! : [];
        if (appendSerializedAiBlocks(blocks)) {
          setCmsAiMultimodalPrompt("");
        }
      } finally {
        setCmsAiLayoutBusy(false);
      }
    },
    [appendSerializedAiBlocks],
  );
  const onCmsAiGeneratePageDraft = useCallback(
    async (promptRaw: string) => {
      const prompt = String(promptRaw ?? "").trim();
      if (!prompt) return;
      if (!aiBlockRunContext?.userId || !aiBlockRunContext?.companyId) {
        setAiError("Mangler bruker- eller firmakontekst for AI. Oppdater siden og prøv igjen.");
        return;
      }
      setCmsAiPageBusy(true);
      setAiError(null);
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            prompt,
            companyId: aiBlockRunContext.companyId,
            userId: aiBlockRunContext.userId,
          }),
        });
        const json = (await res.json().catch(() => null)) as {
          ok?: boolean;
          message?: string;
          data?: { title?: unknown; blocks?: unknown };
        } | null;
        logApiRidFromBody(json);
        if (!res.ok || json?.ok !== true) {
          const msg =
            typeof json?.message === "string" && json.message.trim()
              ? json.message.trim()
              : "Kunne ikke generere sideutkast.";
          setAiError(msg);
          return;
        }
        const aiTitle = String(json.data?.title ?? "").trim();
        const rawBlocks = Array.isArray(json.data?.blocks) ? json.data.blocks : [];
        if (appendSerializedAiBlocks(rawBlocks)) {
          setCmsAiMultimodalPrompt("");
          setSaveStateSafe("dirty");
          if (aiTitle) {
            setTitle((prev) => (prev.trim() ? prev : aiTitle));
          }
        }
      } catch {
        setAiError("Kunne ikke generere sideutkast.");
      } finally {
        setCmsAiPageBusy(false);
      }
    },
    [aiBlockRunContext, appendSerializedAiBlocks],
  );
  const onStartAiAbExperiment = useCallback(async () => {
    const pid = String(effectiveId ?? "").trim();
    if (!pid || page?.status !== "published") {
      setAiError("A/B kan kun startes for en publisert side.");
      setAiAbExperimentNote(null);
      return;
    }
    if (!blocks.length) {
      setAiError("Legg til innhold (blokker) før du starter A/B.");
      setAiAbExperimentNote(null);
      return;
    }
    let blocksPayload: unknown[];
    try {
      blocksPayload = JSON.parse(JSON.stringify(blocks)) as unknown[];
    } catch {
      setAiError("Kunne ikke serialisere blokker for A/B.");
      setAiAbExperimentNote(null);
      return;
    }
    setAiAbExperimentBusy(true);
    setAiError(null);
    setAiAbExperimentNote(null);
    try {
      const res = await fetch("/api/backoffice/experiments/create", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "ai_ab", pageId: pid, blocksB: blocksPayload }),
      });
      const json = (await res.json().catch(() => null)) as {
        ok?: boolean;
        message?: string;
        data?: { experimentId?: string };
      } | null;
      logApiRidFromBody(json);
      if (!res.ok || json?.ok !== true) {
        const msg =
          typeof json?.message === "string" && json.message.trim()
            ? json.message.trim()
            : "Kunne ikke starte A/B-eksperiment.";
        setAiError(msg);
        return;
      }
      const eid = typeof json.data?.experimentId === "string" ? json.data.experimentId.trim() : "";
      setAiAbExperimentNote(
        eid
          ? `A/B er startet (50/50). Eksperiment-ID: ${eid}. Ordre og omsetning spores per variant.`
          : "A/B er startet (50/50). Ordre og omsetning spores per variant.",
      );
    } catch {
      setAiError("Kunne ikke starte A/B-eksperiment.");
    } finally {
      setAiAbExperimentBusy(false);
    }
  }, [effectiveId, page?.status, blocks]);
  const [aiPageIntentPrompt, setAiPageIntentPrompt] = useState("");
  const [aiPageIntentReplace, setAiPageIntentReplace] = useState(false);
  const [aiPageIntentEnrichLayout, setAiPageIntentEnrichLayout] = useState(true);
  const [aiPageIntentExplanation, setAiPageIntentExplanation] = useState<string | null>(null);
  const [aiSectionInsertPrompt, setAiSectionInsertPrompt] = useState("");
  const { busy: aiPageBuilderBusy, generatePage: generatePageFromIntentPipeline, generateSectionInsert } = useAiPageBuilder();
  const onAiPageIntentGenerate = useCallback(async () => {
    const p = aiPageIntentPrompt.trim();
    if (!p) return;
    setAiPageIntentExplanation(null);
    try {
      const { blocks: next, explanation } = await generatePageFromIntentPipeline(p, {
        enrichWithLayoutApi: aiPageIntentEnrichLayout,
      });
      if (aiPageIntentReplace) setBlocks(next);
      else setBlocks((prev) => [...prev, ...next]);
      setSaveStateSafe("dirty");
      setAiPageIntentExplanation(explanation);
      setCanvasMode("preview");
    } catch {
      setAiPageIntentExplanation("Kunne ikke generere siden. Prøv igjen eller kort ned prompten.");
    }
  }, [aiPageIntentPrompt, aiPageIntentReplace, aiPageIntentEnrichLayout, generatePageFromIntentPipeline]);
  const onAiSectionInsertAtSelection = useCallback(async () => {
    const p = aiSectionInsertPrompt.trim();
    if (!p) return;
    const idx = selectedBlockId != null ? blocks.findIndex((b) => b.id === selectedBlockId) : -1;
    const insertAt = idx >= 0 ? idx + 1 : blocks.length;
    const next = await generateSectionInsert(p);
    if (!next.length) return;
    setBlocks((prev) => {
      const copy = [...prev];
      copy.splice(insertAt, 0, ...next);
      return copy;
    });
    setSaveStateSafe("dirty");
    setAiSectionInsertPrompt("");
    setCanvasMode("preview");
  }, [aiSectionInsertPrompt, selectedBlockId, blocks, generateSectionInsert]);
  const rightRailSlots = useContentWorkspaceRightRailSlots({
    isPitch,
    isOffline,
    effectiveId,
    page,
    showBlocks,
    title,
    blocks,
    meta,
    selectedBlockForInspector,
    selectedBlockIndex,
    cmsAiMultimodalPrompt,
    setCmsAiMultimodalPrompt,
    cmsAiLayoutBusy,
    cmsAiPageBusy,
    aiFullPageBusy,
    aiAbExperimentBusy,
    aiCapability,
    onCmsAiGenerateLayout,
    onCmsAiGeneratePageDraft,
    onStartAiAbExperiment,
    aiAbExperimentNote,
    setAiFullPageModalPrompt,
    setAiFullPagePreview,
    setAiFullPageError,
    setAiFullPageReplaceOk,
    setAiFullPageAlsoTitle,
    setAiFullPageModalOpen,
    aiPageBuilderBusy,
    aiPageIntentPrompt,
    setAiPageIntentPrompt,
    aiPageIntentReplace,
    setAiPageIntentReplace,
    aiPageIntentEnrichLayout,
    setAiPageIntentEnrichLayout,
    aiPageIntentExplanation,
    onAiPageIntentGenerate,
    aiSectionInsertPrompt,
    setAiSectionInsertPrompt,
    onAiSectionInsertAtSelection,
    editorCmsMenuDraft,
    setEditorCmsMenuDraft,
    growthPanelEnabled,
    growthProductInput,
    growthAudienceInput,
    setGrowthProductInput,
    setGrowthAudienceInput,
    growthBusy,
    growthError,
    growthSeoOpportunities,
    growthSeoKeywords,
    growthContentIdeas,
    growthAdHeadlines,
    growthAdDescriptions,
    growthFunnelSteps,
    growthFunnelImprovements,
    onGrowthRunSeo,
    onGrowthRunAds,
    onGrowthRunFunnel,
    onGrowthClearPreview,
    autonomyPanelEnabled,
    autonomyBusy,
    autonomyError,
    autonomyMetrics,
    autonomyInsights,
    autonomyDecisionRow,
    autonomyAutomationText,
    onAutonomyRefreshDashboard,
    onAutonomyPreviewAutomation,
    onAutonomyApproveExecute,
    visibleCopilotSuggestions,
    copilotBusy,
    copilotError,
    onCopilotApply,
    onCopilotDismiss,
    aiBusyToolId,
    aiError,
    aiSummary,
    aiBlockBuilderResult,
    aiLastAppliedTool,
    aiScreenshotBuilderResult,
    lastGeneratedImageResult,
    lastLayoutSuggestionsResult,
    diagnosticsResult,
    diagnosticsBusy,
    aiHistory,
    onClearError,
    onRunDiagnostics,
    handleAiImprovePage,
    handleAiSeoOptimize,
    handleAiGenerateSections,
    handleAiStructuredIntent,
    handleLayoutSuggestions,
    handleApplyDesignSuggestion,
    handleDismissDesignSuggestion,
    handleBlockBuilder,
    onBlockBuilderInsert,
    handleAiImageGenerate,
    handleScreenshotBuilder,
    onScreenshotBuilderReplace,
    onScreenshotBuilderAppend,
    handleAiImageImproveMetadata,
    designPanelEnabled,
    controlTowerEnabled,
    designScore,
    designIssues,
    designSuggestions,
    designPreviewSuggestionLines,
    designPreviewBlocks,
    designPanelBusy,
    designPanelError,
    onDesignAnalyze,
    onDesignImprove,
    onDesignApplyPreview,
    onDesignDiscardPreview,
    setBlocks,
    aiAudit,
  });
  const onCmsAiGenerateImageForBlock = useCallback(
    async (blockId: string, promptRaw: string) => {
      const prompt = String(promptRaw ?? "").trim();
      if (!prompt) return;
      setCmsAiImageBusyBlockId(blockId);
      try {
        const res = await fetch("/api/ai/image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ prompt }),
        });
        const json = (await res.json()) as { ok?: boolean; data?: { url?: string; alt?: string } };
        if (!res.ok || json.ok === false) return;
        const url = String(json.data?.url ?? "");
        const alt = String(json.data?.alt ?? "");
        if (!url) return;
        setBlockById(blockId, (current) =>
          current.type === "image" ? { ...current, imageId: url, alt: alt || current.alt } : current,
        );
        setCmsAiImagePromptByBlockId((prev) => {
          const next = { ...prev };
          delete next[blockId];
          return next;
        });
      } finally {
        setCmsAiImageBusyBlockId(null);
      }
    },
    [setBlockById],
  );
  const buildImagePrompt = useCallback(
    (block: Block, presetOverride?: string): string => buildWorkspaceImagePrompt(block, imagePreset, presetOverride),
    [imagePreset],
  );

  const runAiAction = useCallback(
    async (type: "improve" | "shorten" | "seo") => {
      if (!selectedBlock) return;
      if (!selectedBlock.id) return;
      if (actionLock) return;
      if (!aiBlockRunContext?.userId || !aiBlockRunContext?.companyId) {
        setAiError("Mangler bruker- eller firmakontekst for AI. Oppdater siden og prøv igjen.");
        return;
      }
      setActionLock(true);

      const blockId = selectedBlock.id;
      const original = extractWorkspaceBlockText(selectedBlock);

      setAiLoading(true);
      console.time("AI_ACTION");
      try {
        const res = await fetch("/api/ai/block", {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            text: original,
            action: type,
            companyId: aiBlockRunContext.companyId,
            userId: aiBlockRunContext.userId,
          }),
        });

        const data: unknown = await res.json().catch(() => null);
        logApiRidFromBody(data);

        if (!res.ok) {
          console.error("[AI_ACTION_FAILED]", res.status);
          setAiError("Kunne ikke hente resultat");
          bumpMetricsError();
          return;
        }

        const body = data && typeof data === "object" ? (data as { ok?: boolean; data?: { result?: unknown } }) : null;
        if (!body || body.ok !== true) {
          console.error("[AI_ACTION_FAILED]", data);
          setAiError("Kunne ikke hente resultat");
          bumpMetricsError();
          return;
        }

        const result = body.data?.result;
        if (typeof result !== "string") {
          console.error("[AI_ACTION_FAILED]", "invalid_result");
          setAiError("Kunne ikke hente resultat");
          bumpMetricsError();
          return;
        }

        // Selection might have changed while the request was in flight.
        if (selectedBlockId !== blockId) return;

        // Update ONLY the selected block content, using the canonical setBlockById flow.
        setBlockById(blockId, (current) => {
          if (current.type === "richText") return { ...current, body: result };
          return current;
        });

        bumpMetricsAction();
      } catch (e) {
        console.error("[AI_ACTION_FAILED]", e);
        setAiError("Kunne ikke hente resultat");
        bumpMetricsError();
      } finally {
        console.timeEnd("AI_ACTION");
        setAiLoading(false);
        setActionLock(false);
      }
    },
    [actionLock, aiBlockRunContext, bumpMetricsAction, bumpMetricsError, selectedBlock, selectedBlockId, setBlockById]
  );

  const runAiSuggest = useContentWorkspaceRunAiSuggest({
    selectedBlock,
    selectedBlockId,
    blocks,
    aiBlockRunContext,
    aiCacheRef,
    setAiSuggestion,
    setAiError,
    setAiScore,
    setAiHints,
    setAiSuggestLoading,
    bumpMetricsAction,
    bumpMetricsError,
  });

  const runAiBuild = useCallback(async () => {
    setAiBuildLoading(true);
    try {
      const res = await fetch("/api/ai/page/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product: aiProduct,
          audience: aiAudience,
          intent: aiIntent,
        }),
      });

      const data: unknown = await res.json().catch(() => null);
      const blocks = (data as { data?: { blocks?: unknown } } | null)?.data?.blocks ?? null;
      if (Array.isArray(blocks)) {
        setAiBuildResult(blocks as any[]);
      }
    } finally {
      setAiBuildLoading(false);
    }
  }, [aiAudience, aiIntent, aiProduct]);

  const runAiAudit = useCallback(async () => {
    if (!blocks || blocks.length === 0) return;

    setAiAuditLoading(true);
    try {
      const res = await fetch("/api/ai/page/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocks }),
      });

      const data: unknown = await res.json().catch(() => null);
      const score = (data as { data?: { score?: unknown } } | null)?.data?.score ?? null;
      const issues = (data as { data?: { issues?: unknown } } | null)?.data?.issues ?? [];

      if (typeof score === "number") {
        setAiAudit({
          score,
          issues: Array.isArray(issues) ? issues.filter((i: unknown): i is string => typeof i === "string") : [],
        });
      }
    } finally {
      setAiAuditLoading(false);
    }
  }, [blocks]);

  const runAiImage = useCallback(async () => {
    if (!selectedBlock) return;
    if (!selectedBlock.id) return;
    if (selectedBlock.type !== "hero" && selectedBlock.type !== "image") return;

    if (actionLock) return;
    setActionLock(true);

    const autoPreset = resolveWorkspaceImagePreset(selectedBlock);
    setImagePreset(autoPreset);
    const variations = 3;
    const results: Array<{ url: string; assetId?: string }> = [];

    setAiImageLoading(true);
    try {
      for (let i = 0; i < variations; i++) {
        const prompt = `${buildImagePrompt(selectedBlock, autoPreset)} variasjon ${i}`;
        const res = await fetch("/api/backoffice/ai/image-generator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ prompt, generate: true }),
        });

        const data: unknown = await res.json().catch(() => null);
        logApiRidFromBody(data);
        if (!res.ok) {
          console.error("[AI_ACTION_FAILED]", res.status);
          setAiError("Kunne ikke hente resultat");
          bumpMetricsError();
          break;
        }
        const body = data && typeof data === "object" ? (data as { ok?: boolean; data?: { assetId?: unknown; url?: unknown } }) : null;
        if (!body || body.ok !== true) {
          console.error("[AI_ACTION_FAILED]", data);
          setAiError("Kunne ikke hente resultat");
          bumpMetricsError();
          break;
        }
        const assetId = body.data?.assetId;
        const url = body.data?.url;
        if (typeof url === "string" && url) {
          results.push({
            url,
            assetId: typeof assetId === "string" ? assetId : undefined,
          });
        }
      }

      setAiImages(results.length > 0 ? results : null);
      if (results.length > 0) bumpMetricsAction();
    } catch (e) {
      console.error("[AI_ACTION_FAILED]", e);
      setAiError("Kunne ikke hente resultat");
      bumpMetricsError();
    } finally {
      setAiImageLoading(false);
      setActionLock(false);
    }
  }, [actionLock, bumpMetricsAction, bumpMetricsError, selectedBlock, buildImagePrompt]);

  const runAiImageBatch = useCallback(async () => {
    await runWorkspaceAiImageBatch({
      blocks,
      actionLock,
      setActionLock,
      setAiError,
      bumpMetricsAction,
      bumpMetricsError,
      setBlockById,
      setAiBatchProgress,
      setAiBatchLoading,
      imagePreset,
    });
  }, [actionLock, blocks, bumpMetricsAction, bumpMetricsError, imagePreset, setBlockById]);

  const applyImage = useCallback(
    (picked: { url: string; assetId?: string }) => {
      applyBlockImagePick(picked, selectedBlock, setBlockById);
      if (!selectedBlock?.id) return;
      if (selectedBlock.type !== "hero" && selectedBlock.type !== "hero_full" && selectedBlock.type !== "image") return;
      setSelectedBlockId(selectedBlock.id);
      setAiImages(null);
    },
    [selectedBlock, setBlockById, setSelectedBlockId]
  );

  const onDuplicateBlock = useCallback(
    (blockId: string) => {
      const current = blocks.find((b) => b.id === blockId);
      if (
        current &&
        !isBlockTypeAllowedForDocumentType(
          documentTypeAlias,
          String(current.type ?? ""),
          mergedBlockEditorDataTypes,
          mergedDocumentTypeDefinitions,
        )
      ) {
        pushToast({
          kind: "warning",
          title: "Kan ikke duplisere",
          message:
            "Blokktypen er ikke tillatt for gjeldende dokumenttype. Endre dokumenttype eller fjern blokken før lagring.",
        });
        return;
      }
      if (!canAddBlockForDataType(documentTypeAlias, blocks.length, mergedBlockEditorDataTypes, mergedDocumentTypeDefinitions)) {
        pushToast({
          kind: "warning",
          title: "Maks antall blokker",
          message: "Data type-grensen er nådd — fjern eller bytt ut en blokk før du dupliserer.",
        });
        return;
      }
      duplicateBlockInWorkspaceList(blockId, {
        setBlocks,
        setSelectedBlockId,
        queueBlockEnterAnimation,
        blockPulseTimerRef,
        setBlockPulseId,
      });
    },
    [
      blocks,
      documentTypeAlias,
      mergedBlockEditorDataTypes,
      mergedDocumentTypeDefinitions,
      pushToast,
      queueBlockEnterAnimation,
      setBlocks,
      setSelectedBlockId,
      setBlockPulseId,
    ]
  );

  useEffect(() => {
    return () => {
      if (blockPulseTimerRef.current) clearTimeout(blockPulseTimerRef.current);
    };
  }, []);

  useContentWorkspaceDemoWowPitchOverlayEffects({
    isDemo,
    isWow,
    isPitch,
    pitchStep,
    blocks,
    setBodyMode,
    setBlocks,
    setSelectedBlockId,
    setTitle,
    setSlug,
    setLastError,
    setOriginalBlocks,
    setShowAfter,
    setPitchStep,
    wowHasRunRef,
    demoBlocks: EditorK.DEMO_BLOCKS,
    runAiAction,
    runAiAudit,
  });

  const historyPreviewBlocks = useHistoryPreviewBlocksForChromeShell(historyVersionPreview);

  const blocksForLivePreview = useMemo(() => {
    const base = historyPreviewBlocks ?? displayBlocks;
    if (!editOpen || editIndex == null || !editModalLiveBlock) return base;
    return base.map((b, i) =>
      i === editIndex ? ({ ...b, ...editModalLiveBlock } as Block) : b
    );
  }, [historyPreviewBlocks, editOpen, editIndex, editModalLiveBlock, displayBlocks]);

  const pageCmsMetaForPreview = useMemo(() => {
    if (historyVersionPreview?.body != null) {
      return parseBodyToBlocks(historyVersionPreview.body).meta;
    }
    return meta;
  }, [historyVersionPreview, meta]);

  const { visualPreviewFieldHints, visualInlineEditApi } = useChromeVisualPreviewShellPair({
    showPreview, historyVersionPreview, blocks, blocksForLivePreview, selectedBlockId, visualPatchPendingRef, visualPatchTimerRef,
    flushVisualCanvasPatches, onDeleteBlock, setMediaPickerTarget, setMediaPickerOpen, setEditIndex, setEditOpen,
  });

  const canReorderBlocks = !(isWow && !showAfter && Array.isArray(originalBlocks));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 280, tolerance: 8 },
    }),
  );

  const onDragEndReorder = useBlockListDragEndHandler({
    canReorder: canReorderBlocks,
    setBlocks,
  });

  useContentWorkspaceOnboardingOverlayEffects({
    onboardingDoneKey: EditorK.ONBOARDING_DONE_KEY,
    onboardingStep,
    setOnboardingStep,
    selectedBlockId,
    blocks,
    setSelectedBlockId,
  });

  useEffect(() => {
    setAiSuggestion(null);
    setAiScore(null);
    setAiHints([]);
    setAiImages(null);
    if (!selectedBlockId) return;
    const t = setTimeout(() => {
      void runAiSuggest();
    }, 300);
    return () => clearTimeout(t);
  }, [selectedBlockId, runAiSuggest]);

  const blockInspectorCtx: BlockInspectorFieldsCtx = useBlockInspectorWorkspaceCtxFromShell({
    setBlockById,
    setMediaPickerTarget,
    setMediaPickerOpen,
    isOffline,
    effectiveId,
    aiBusyToolId,
    handleAiStructuredIntent,
    richText: {
      richTextDirectAiBusy,
      richTextInline,
      setRichTextInline,
      inlineAbortRef,
      inlineBodyRunRef,
      inlineBodyDebounceRef,
      fetchRichTextInlineBody,
      runRichTextContinueAtCursor,
      runRichTextRewriteSelection,
      richTextInlineRef,
      cmsAiImagePromptByBlockId,
      setCmsAiImagePromptByBlockId,
      cmsAiImageBusyBlockId,
      onCmsAiGenerateImageForBlock,
    },
  });

  const isForsidePage = useCallback(() => isForside(slug, title), [slug, title]);

  const onFillForsideFromRepo = useCallback(async () => {
    if (isOffline) return;
    await fetchBuildHomeFromRepoIntent({
      clearAutosaveTimer,
      setBuildHomeFromRepoBusy,
      setLastError,
      setRefetchDetailKey,
      router,
    });
  }, [clearAutosaveTimer, isOffline, router, setRefetchDetailKey]);

  const onConvertLegacyBody = useCallback(() => {
    if (isForsidePage()) {
      void onFillForsideFromRepo();
      return;
    }

    const next = createRichTextBlockFromLegacyText(legacyBodyText);

    setBodyMode("blocks");
    setBodyParseError(null);
    setLegacyBodyText("");
    setInvalidBodyRaw("");
    setBlocks([next]);
    setSelectedBlockId(next.id);
  }, [legacyBodyText, isForsidePage, onFillForsideFromRepo, setSelectedBlockId]);

  const onResetInvalidBodyRequest = useCallback(() => {
    requestInvalidBodyResetConfirm();
  }, [requestInvalidBodyResetConfirm]);

  const cancelInvalidBodyReset = useCallback(() => {
    closeInvalidBodyResetConfirm();
  }, [closeInvalidBodyResetConfirm]);

  const executeResetInvalidBody = useCallback(() => {
    closeInvalidBodyResetConfirm();
    setBodyMode("blocks");
    setBodyParseError(null);
    setLegacyBodyText("");
    setInvalidBodyRaw("");
    setBlocks([]);
    setSelectedBlockId(null);
  }, [
    closeInvalidBodyResetConfirm,
    setBodyMode,
    setBodyParseError,
    setLegacyBodyText,
    setInvalidBodyRaw,
    setBlocks,
    setSelectedBlockId,
  ]);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);

  useEffect(() => {
    if (dirty && (saveState === "idle" || saveState === "saved")) setSaveStateSafe("dirty");
    if (!dirty && saveState === "dirty") setSaveStateSafe("idle");
  }, [dirty, saveState]);

  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  useEffect(() => {
    return () => {
      if (activeAbortRef.current) activeAbortRef.current.abort();
      if (statusAbortRef.current) statusAbortRef.current.abort();
    };
  }, []);

  useEffect(() => {
    if (pageNotFound || detailError || !dirty || !effectiveId || !page) return;
    if (outboxWriteTimerRef.current) clearTimeout(outboxWriteTimerRef.current);
    outboxWriteTimerRef.current = setTimeout(() => {
      outboxWriteTimerRef.current = null;
      const draft: OutboxDraft = {
        title: safeStr(title),
        slug: normalizeSlug(slug),
        status: statusLabel,
        body: bodyForSave as string,
      };
      const fingerprint = fingerprintOutboxDraft(draft);
      writeOutbox({
        pageId: effectiveId,
        savedAtLocal: new Date().toISOString(),
        updatedAtSeen: lastServerUpdatedAt,
        draft,
        fingerprint,
      });
    }, 250);
    return () => {
      if (outboxWriteTimerRef.current) {
        clearTimeout(outboxWriteTimerRef.current);
        outboxWriteTimerRef.current = null;
      }
    };
  }, [pageNotFound, detailError, dirty, effectiveId, page, title, slug, bodyForSave, statusLabel, lastServerUpdatedAt]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(safeStr(queryInput)), 180);
    return () => clearTimeout(timer);
  }, [queryInput]);

  useEffect(() => {
    if (!createSlugTouched) setCreateSlug(normalizeSlug(createTitle));
  }, [createTitle, createSlugTouched]);

  useEffect(() => {
    if (!slugTouched) setSlug(normalizeSlug(title));
  }, [title, slugTouched]);

  useEffect(() => {
    if (!headerVariant) {
      setHeaderEditConfig(null);
      setHeaderEditError(null);
      setHeaderEditLoading(false);
    }
  }, [headerVariant]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsOffline(!navigator.onLine);
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (pageNotFound || !dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [pageNotFound, dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = safeStr(event.key).toLowerCase();
      const saveCombo = (event.ctrlKey || event.metaKey) && key === "s";
      if (!saveCombo) return;
      if (!selectedId || !dirty || savingRef.current) return;

      event.preventDefault();
      void saveDraft("shortcut");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, dirty, saveDraft]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (pendingNavigationHref) {
        event.preventDefault();
        cancelPendingNavigation();
        return;
      }
      if (invalidBodyResetConfirmOpen) {
        event.preventDefault();
        cancelInvalidBodyReset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pendingNavigationHref, invalidBodyResetConfirmOpen, cancelPendingNavigation, cancelInvalidBodyReset]);

  const draftKey = useMemo(() => `${title}\n${slug}\n${bodyForSave}`, [title, slug, bodyForSave]);

  useEffect(() => {
    clearAutosaveTimer();
    if (!dirty) return;
    if (pageNotFound || !selectedId || detailLoading || hasConflict || isOffline || !page || detailError) return;
    if (saveState !== "idle" && saveState !== "saved") return;
    if (skipNextAutosaveScheduleRef.current) {
      skipNextAutosaveScheduleRef.current = false;
      return;
    }

    autosaveTimerRef.current = setTimeout(() => {
      if (!dirtyRef.current || savingRef.current) return;
      void saveDraft("autosave");
    }, 800);

    return clearAutosaveTimer;
  }, [pageNotFound, selectedId, dirty, detailLoading, hasConflict, isOffline, page, detailError, draftKey, saveDraft, clearAutosaveTimer, saveState]);

  async function onCreate(ev: React.FormEvent<HTMLFormElement>) {
    await submitCreateContentPageFromForm(ev, {
      creating,
      createTitle,
      createSlug,
      createDocumentTypeAlias,
      setCreating,
      setCreateError,
      setCreateTitle,
      setCreateSlug,
      setCreateSlugTouched,
      setCreateDocumentTypeAlias,
      setListReloadKey,
      setCreatePanelOpen,
      setCreatePanelMode,
      guardPush,
    });
  }

  const legacySidebarProps: ContentWorkspaceLegacySidebarModelProps = {
    hjemSingleClickTimerRef,
    hjemExpanded,
    setHjemExpanded,
    items,
    selectContentPage,
    selectedId,
    page,
    normalizeSlug,
    setCreatePanelOpen,
    setCreatePanelMode,
    mainView,
    goToGlobalWorkspace,
    goToDesignWorkspace,
    embedded,
    queryInput,
    setQueryInput,
    listError,
    listLoading,
    createPanelOpen,
    createPanelMode,
    createParentLoading,
    allowedChildTypes,
    onCreate,
    createTitle,
    setCreateTitle,
    createSlug,
    setCreateSlug,
    setCreateSlugTouched,
    createError,
    creating,
    createDocumentTypeAlias,
    setCreateDocumentTypeAlias,
    setAllowedChildTypes,
    setCreateParentLoading,
  };

  const pageEditorShellBundle = buildContentWorkspacePageEditorShellBundle({
    designTab,
    setDesignTab,
    colorsContentBg,
    colorsButtonBg,
    colorsButtonText,
    colorsButtonBorder,
    setColorsContentBg,
    setColorsButtonBg,
    setColorsButtonText,
    setColorsButtonBorder,
    labelColors,
    setLabelColors,
    exitGlobalSubView,
    contentSettingsTab,
    setContentSettingsTab,
    contentDirection,
    setContentDirection,
    emailPlatform,
    setEmailPlatform,
    captchaVersion,
    setCaptchaVersion,
    notificationEnabled,
    setNotificationEnabled,
    globalSubView,
    globalPanelTab,
    setGlobalPanelTab,
    openGlobalSubViewCard,
    headerVariant,
    setHeaderVariant,
    headerEditConfig,
    setHeaderEditConfig,
    headerEditLoading,
    setHeaderEditLoading,
    headerEditError,
    setHeaderEditError,
    headerEditSaving,
    setHeaderEditSaving,
    footerTab,
    setFooterTab,
    navigationTab,
    setNavigationTab,
    hideMainNavigation,
    setHideMainNavigation,
    hideSecondaryNavigation,
    setHideSecondaryNavigation,
    hideFooterNavigation,
    setHideFooterNavigation,
    hideMemberNavigation,
    setHideMemberNavigation,
    hideCtaNavigation,
    setHideCtaNavigation,
    hideLanguageNavigation,
    setHideLanguageNavigation,
    multilingualMode,
    setMultilingualMode,
    statusLine,
    supportSnapshot,
    supportCopyFeedback,
    copySupportSnapshot,
    reloadDetailFromServer,
    isOffline,
    guardPush,
    page,
    editor2Model,
    setEditor2Model,
    editor2SelectedBlockId,
    setEditor2SelectedBlockId,
    editor2PendingFocusIdRef,
    onSetStatus,
    performSave,
    canPublish,
    canUnpublish,
    canSave,
    isPublished,
    editor2Validation,
    editor2FocusNonce,
    setEditor2FocusNonce,
    editor2BlockListRef,
    editor2ResetSearchNonce,
    isContentTab,
    hideLegacyNav: hideLegacySidebar,
    editorCanvasRef,
    rightRailSlots,
    chrome: {
      shared: [mainView, setMainView, canvasMode, previewDevice, title, slug, setTitle, setCanvasMode, setPreviewDevice, isOffline],
      editor: [statusLabel, statusLine, supportSnapshot, supportCopyFeedback, canPublish, canUnpublish, selectedId, publishDisabledTitle, unpublishDisabledTitle, copySupportSnapshot, performSave, reloadDetailFromServer, onSave, onSetStatus, canSave, recoveryBannerVisible, outboxData, hasFingerprintConflict, outboxDetailsExpanded, setOutboxDetailsExpanded, copyOutboxSafetyExport, outboxCopyFeedback, onRestoreOutbox, onDiscardOutbox, formatDate, canOpenPublic, onOpenPublicPage, publishReadiness],
      main: [historyPreviewBlocks, displayBlocks, historyVersionPreview, effectiveId, showPreview, previewLayoutMode, setPreviewLayoutMode, showBlocks, showPreviewColumn, setShowPreviewColumn, bodyMode, bodyParseError, onConvertLegacyBody, onResetInvalidBodyRequest, executeResetInvalidBody, cancelInvalidBodyReset, invalidBodyResetConfirmOpen, blocks, isForsidePage, buildHomeFromRepoBusy, onFillForsideFromRepo, addInsertIndexRef, setBlockPickerOpen, sensors, onDragEndReorder, canReorderBlocks, selectedBlockId, setSelectedBlockId, hoverBlockId, setHoverBlockId, blockPulseId, newBlockAnimationIds, onMoveBlock, onDuplicateBlock, onDeleteBlock, setEditIndex, setEditOpen, aiSuggestLoading, aiSuggestion, setBlockById, setAiSuggestion, aiScore, aiHints, aiImageLoading, blocksForLivePreview, visualInlineEditApi, setHistoryVersionPreview, pageCmsMetaForPreview, onNavigateToGlobalDesignSettings],
      properties: [
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
      ],
      tri: [onSelectBlockFromTree, aiCapability, aiSummary, aiError],
    },
    isDemo,
    isWow,
    editorLocale,
    effectiveId,
    detailLoading,
    pageNotFound,
    detailError,
    selectedId,
    saving,
    onSaveAndPreview,
    onSave,
    setHistoryVersionPreview,
    setShowPreviewColumn,
    clearAutosaveTimer,
    setTitle,
    setSlug,
    setSlugTouched,
    applyParsedBody,
    setSavedSnapshot,
    setPage,
    updateSidebarItem,
    setLastSavedAt,
    setSaveStateSafe,
    setLastError,
    isPitch,
    aiProduct,
    setAiProduct,
    aiAudience,
    setAiAudience,
    aiIntent,
    setAiIntent,
    runAiBuild,
    aiBuildLoading,
    runAiAudit,
    aiAuditLoading,
    onboardingStep,
    setOnboardingStep,
    aiBuildResult,
    setBlocks,
    selectedBlock,
    imagePresetLabels: EditorK.IMAGE_PRESETS as Record<string, string>,
    imagePreset,
    setImagePreset,
    runAiImage,
    runAiImageBatch,
    aiAnyLoading,
    aiImageLoading,
    aiBatchLoading,
    runAiAction,
    aiBatchProgress,
    aiImages,
    applyImage,
    demoBlocks: EditorK.DEMO_BLOCKS,
    setSelectedBlockId,
    setOriginalBlocks,
    setShowAfter,
    wowHasRunRef,
  });

  const pageEditorShellProps: ContentWorkspacePageEditorShellModelProps = {
    pendingNavigationHref,
    confirmPendingNavigation,
    cancelPendingNavigation,
    globalSubView,
    selectedId,
    pageNotFound,
    detailLoading,
    detailError,
    page,
    hasConflict,
    guardPush,
    useEditor2,
    historyView: {
      pageId: effectiveId,
      locale: "nb",
      environment: "prod",
      pageUpdatedAt: page?.updated_at ?? null,
      historyStatus: bellissimaSnapshot?.historyStatus ?? "unavailable",
      documentTypeAlias,
      governedPosture: bellissimaSnapshot?.governedPosture ?? "unknown",
      publishState: statusLabel,
      previewHref: bellissimaSnapshot?.previewHref ?? null,
      onApplyHistoryPreview: setHistoryVersionPreview,
      onApplyRestoredPage: (restored) => {
        setHistoryVersionPreview(null);
        clearAutosaveTimer();
        const nextTitle = safeStr(restored.title);
        const nextSlug = safeStr(restored.slug);
        const envelope = parseBodyEnvelope(restored.body);
        const parsedBody = parseBodyToBlocks(envelope.blocksBody);
        const snapshotBody = snapshotBodyFromPageBody(restored.body);
        const nextStatus = restored.status === "published" ? "published" : "draft";

        setTitle(nextTitle);
        setSlug(nextSlug);
        setSlugTouched(false);
        applyParsedBody(parsedBody);
        setSavedSnapshot(
          makeSnapshot({
            title: nextTitle,
            slug: nextSlug,
            body: snapshotBody,
          })
        );
        setPage((prev) =>
          prev
            ? {
                ...prev,
                id: restored.id,
                title: nextTitle,
                slug: nextSlug,
                status: nextStatus,
                created_at: restored.created_at ?? prev.created_at,
                updated_at: restored.updated_at ?? prev.updated_at,
                published_at: restored.published_at ?? prev.published_at,
                body: restored.body,
                variantId: restored.variantId ?? prev.variantId,
              }
            : null
        );
        updateSidebarItem({
          id: restored.id,
          title: nextTitle,
          slug: nextSlug,
          status: nextStatus,
          created_at: restored.created_at,
          updated_at: restored.updated_at,
          published_at: restored.published_at,
          body: restored.body,
        });
        setLastSavedAt(restored.updated_at ?? new Date().toISOString());
        setSaveStateSafe("saved");
        setLastError(null);
      },
    },
    ...pageEditorShellBundle,
  };

  const triPaneMountProps =
    buildContentWorkspaceTriPaneShellMountPropsFromWorkspaceBundle(
      pageEditorShellBundle.triPaneBundleInput,
    );
  const chromeShellProps = buildWorkspaceChromeShellPropsFromWire(triPaneMountProps.chromeWire);
  const auxiliaryShellProps = buildContentWorkspaceAuxiliaryShellProps(
    buildWorkspaceAuxiliaryShellArgs(triPaneMountProps.auxiliaryWire),
  );
  const {
    editorChrome: editorChromeProps,
    mainCanvas,
    propertiesRail,
    rightRailSlots: chromeRightRailSlots,
    triPaneLeft,
  } = chromeShellProps;
  const showCanonicalEditorSurfaces =
    !useEditor2 &&
    Boolean(page) &&
    !pageNotFound &&
    !detailLoading &&
    !detailError &&
    !hasConflict;
  const structureSelectionIndex =
    triPaneLeft.selectedBlockId != null
      ? triPaneLeft.displayBlocks.findIndex((block) => block.id === triPaneLeft.selectedBlockId)
      : -1;
  const structureSelection =
    structureSelectionIndex >= 0 ? triPaneLeft.displayBlocks[structureSelectionIndex] ?? null : null;
  const previousStructureBlock =
    structureSelectionIndex > 0
      ? triPaneLeft.displayBlocks[structureSelectionIndex - 1] ?? null
      : null;
  const nextStructureBlock =
    structureSelectionIndex >= 0 &&
    structureSelectionIndex < triPaneLeft.displayBlocks.length - 1
      ? triPaneLeft.displayBlocks[structureSelectionIndex + 1] ?? null
      : null;

  const leftSidebarProps = {
    hideLegacyNav: chromeShellProps.hideLegacyNav,
    legacyNavSlot: createElement(
      "p",
      { className: "px-1 text-xs text-[rgb(var(--lp-muted))]" },
      "Bruk navigasjonen i kolonnen helt til venstre for å velge side.",
    ),
    structureSlot: triPaneLeft.showBlocks
      ? createElement(EditorStructureTree, {
          nodeId: triPaneLeft.selectedId,
          selectedBlockId: triPaneLeft.selectedBlockId,
          onSelectBlock: triPaneLeft.onSelectBlockFromTree,
          hoverBlockId: triPaneLeft.hoverBlockId,
          onHoverBlock: triPaneLeft.setHoverBlockId,
          pageTitle: (triPaneLeft.page?.title ?? triPaneLeft.title).trim() || "—",
          blocks: triPaneLeft.displayBlocks,
        })
      : createElement(
          "p",
          { className: "px-1 text-xs text-[rgb(var(--lp-muted))]" },
          "Ingen blokker på denne siden.",
        ),
    aiContextSlot: createElement(ContentAiContextPanel, {
      aiCapability: triPaneLeft.aiCapability,
      pageId: triPaneLeft.effectiveId,
      pageTitle: (triPaneLeft.page?.title ?? triPaneLeft.title).trim() || "—",
      pageSlug: (triPaneLeft.slug ?? triPaneLeft.page?.slug ?? "").toString(),
      selectedBlockId: triPaneLeft.selectedBlockId,
      focusedBlockLabel: structureSelection
        ? `${structureSelectionIndex + 1}. ${getBlockLabel(structureSelection.type)}`
        : null,
      neighborContext:
        structureSelectionIndex < 0
          ? null
          : {
              prev: previousStructureBlock ? getBlockTreeLabel(previousStructureBlock) : null,
              next: nextStructureBlock ? getBlockTreeLabel(nextStructureBlock) : null,
            },
      aiSummary: triPaneLeft.aiSummary,
      aiError: triPaneLeft.aiError,
    }),
  } satisfies ContentWorkspaceLeftSidebarModelProps;

  const rightPanelProps = {
    aiSlot: chromeRightRailSlots.aiSlot,
    diagnoseSlot: chromeRightRailSlots.diagnoseSlot,
    ceoSlot: chromeRightRailSlots.ceoSlot,
  } satisfies ContentWorkspaceRightPanelModelProps;

  const workspaceBodyProps = {
    bodyMode: mainCanvas.bodyMode,
    bodyParseError: mainCanvas.bodyParseError,
    onConvertLegacyBody: mainCanvas.onConvertLegacyBody,
    onResetInvalidBodyRequest: mainCanvas.onResetInvalidBodyRequest,
    executeResetInvalidBody: mainCanvas.executeResetInvalidBody,
    cancelInvalidBodyReset: mainCanvas.cancelInvalidBodyReset,
    invalidBodyResetConfirmOpen: mainCanvas.invalidBodyResetConfirmOpen,
    blocks: mainCanvas.blocks,
    displayBlocks: mainCanvas.displayBlocks,
    isForsidePage: mainCanvas.isForsidePage,
    buildHomeFromRepoBusy: mainCanvas.buildHomeFromRepoBusy,
    isOffline: mainCanvas.isOffline,
    onFillForsideFromRepo: mainCanvas.onFillForsideFromRepo,
    addInsertIndexRef: mainCanvas.addInsertIndexRef,
    setBlockPickerOpen: mainCanvas.setBlockPickerOpen,
    sensors: mainCanvas.sensors,
    onDragEndReorder: mainCanvas.onDragEndReorder,
    canReorderBlocks: mainCanvas.canReorderBlocks,
    selectedBlockId: mainCanvas.selectedBlockId,
    setSelectedBlockId: mainCanvas.setSelectedBlockId,
    hoverBlockId: mainCanvas.hoverBlockId,
    setHoverBlockId: mainCanvas.setHoverBlockId,
    blockPulseId: mainCanvas.blockPulseId,
    newBlockAnimationIds: mainCanvas.newBlockAnimationIds,
    onMoveBlock: mainCanvas.onMoveBlock,
    onDuplicateBlock: mainCanvas.onDuplicateBlock,
    onDeleteBlock: mainCanvas.onDeleteBlock,
    setEditIndex: mainCanvas.setEditIndex,
    setEditOpen: mainCanvas.setEditOpen,
    aiSuggestLoading: mainCanvas.aiSuggestLoading,
    aiSuggestion: mainCanvas.aiSuggestion,
    setBlockById: mainCanvas.setBlockById,
    setAiSuggestion: mainCanvas.setAiSuggestion,
    aiScore: mainCanvas.aiScore,
    aiHints: mainCanvas.aiHints,
    aiImageLoading: mainCanvas.aiImageLoading,
    blocksForLivePreview: mainCanvas.blocksForLivePreview,
    visualInlineEditApi: mainCanvas.visualInlineEditApi,
    setHistoryVersionPreview: mainCanvas.setHistoryVersionPreview,
    title: mainCanvas.title,
    onNavigateToGlobalDesignSettings: mainCanvas.onNavigateToGlobalDesignSettings,
    pageCmsMetaForPreview: mainCanvas.pageCmsMetaForPreview,
    blockListCreateLabel,
    blockListAddDisabled,
    blockPropertyDataTypeAlias,
    documentTypeAliasForCanvas: documentTypeAlias,
    documentTypeTitleForCanvas: resolvedDocumentTypeForCanvas?.title ?? null,
    documentTypeDescriptionForCanvas: resolvedDocumentTypeForCanvas?.description ?? null,
    bodyPropertyTitleForCanvas: bodyPropertyForCanvas?.title ?? null,
    bodyPropertyDescriptionForCanvas: bodyPropertyForCanvas?.description ?? null,
    bodyGroupTitleForCanvas: bodyGroupForCanvas?.title ?? null,
    templateBindingAliasForCanvas:
      resolvedDocumentTypeForCanvas?.defaultTemplate ??
      resolvedDocumentTypeForCanvas?.templates?.[0] ??
      null,
  } satisfies ContentWorkspaceBodyModelProps;

  const workspacePreviewProps = {
    previewDevice: mainCanvas.previewDevice,
    bodyMode: mainCanvas.bodyMode,
    bodyParseError: mainCanvas.bodyParseError,
    historyPreviewBlocks: mainCanvas.historyPreviewBlocks,
    displayBlocks: mainCanvas.historyPreviewBlocks ?? mainCanvas.blocksForLivePreview,
    historyVersionPreview: mainCanvas.historyVersionPreview,
    title: mainCanvas.title,
    slug: mainCanvas.slug,
    pageSlug: mainCanvas.pageSlug,
    effectiveId: mainCanvas.effectiveId,
    pageCmsMetaForPreview: mainCanvas.pageCmsMetaForPreview,
  } satisfies ContentWorkspacePreviewModelProps;

  const workspaceInspectorProps: ContentWorkspaceInspectorModelProps = propertiesRail;

  const modalShellProps: ContentWorkspaceModalShellModelProps =
    buildContentWorkspaceModalShellPropsFromWorkspaceFlatFields({
      aiFullPageModalOpen,
      closeAiFullPageModal,
      aiFullPageModalPrompt,
      setAiFullPageModalPrompt,
      aiFullPageBusy,
      aiFullPageError,
      aiFullPagePreview,
      aiFullPagePreviewBlocks,
      aiFullPageReplaceOk,
      setAiFullPageReplaceOk,
      aiFullPageAlsoTitle,
      setAiFullPageAlsoTitle,
      onAiFullPageModalGenerate,
      onAiFullPageModalApply,
      blockPickerOpen,
      page,
      slug,
      title,
      isForside,
      setBlockPickerOpen,
      addInsertIndexRef,
      setBodyMode,
      setBodyParseError,
      setLegacyBodyText,
      setInvalidBodyRaw,
      setBlocks,
      setSelectedBlockId,
      editOpen,
      blocks,
      editIndex,
      setEditModalLiveBlock,
      setEditOpen,
      setEditIndex,
      onDeleteBlock,
      mediaPickerOpen,
      mediaPickerTarget,
      setMediaPickerOpen,
      setMediaPickerTarget,
      setBlockById,
      documentTypeAlias,
      onboardingStep,
      setOnboardingStep,
      onboardingDoneKey: EditorK.ONBOARDING_DONE_KEY,
      isPitch,
      pitchStep,
      runAiAction,
      runAiAudit,
      runAiImage,
      setShowAfter,
      setPitchStep,
      mergedBlockEditorDataTypes,
      mergedDocumentTypeDefinitions,
    });

  const debugOverlaysProps: ContentWorkspaceDebugOverlaysModelProps = {
    isDev,
    metrics,
    selectedBlockId,
    effectiveId,
  };

  return {
    activeWorkspaceView: mainView,
    hideLegacySidebar,
    legacySidebarProps,
    pageEditorShellProps,
    showCanonicalEditorSurfaces,
    editorCanvasRef,
    editorChromeProps,
    leftSidebarProps,
    rightPanelProps,
    workspaceBodyProps,
    workspacePreviewProps,
    workspaceInspectorProps,
    auxiliaryShellProps,
    modalShellProps,
    debugOverlaysProps,
  } satisfies ContentWorkspaceShellModel;
}

