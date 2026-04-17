"use client";

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { usePathname } from "next/navigation";
import type { DragEndEvent } from "@dnd-kit/core";
import { resolveBackofficeContentRoute } from "@/lib/cms/backofficeContentRoute";

import type { BlockInspectorWorkspaceCtx } from "./blockPropertyEditorContract";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { PublicPageVisualInlineEdit } from "./PreviewCanvas";
import { BlockInspectorFields } from "./BlockInspectorFields";
import { resolveElementRuntimeLabel } from "./blockLabels";
import type { ContentWorkspacePropertiesRailProps } from "./ContentWorkspacePropertiesRail";
import type { Block } from "./editorBlockTypes";
import { useElementTypeRuntimeMergedOptional } from "./ElementTypeRuntimeMergedContext";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import { ContentDetailDocumentEditor } from "./ContentDetailDocumentEditor";
import { PreviewCanvas } from "./PreviewCanvas";
import { UmbracoBlockPropertyField, type UmbracoBlockRow } from "./UmbracoBlockPropertyField";
import {
  blockRowComponentLine,
  blockTypeSubtitle,
  blockTypeSubtitleForComponentBuilder,
  splitBlockRowSummaryLines,
  type BodyMode,
} from "./contentWorkspace.blocks";
import type { ContentDetailEditorMode } from "./useContentWorkspaceUi";

/* =========================================================
   TYPES
========================================================= */

export type WorkspaceBodyProps = {
  bodyMode: BodyMode;
  bodyParseError: string | null;

  onConvertLegacyBody: () => void;
  onResetInvalidBodyRequest: () => void;
  executeResetInvalidBody: () => void;
  cancelInvalidBodyReset: () => void;
  invalidBodyResetConfirmOpen: boolean;

  blocks: Block[];
  displayBlocks: Block[];

  isForsidePage: () => boolean;
  buildHomeFromRepoBusy: boolean;
  isOffline: boolean;
  onFillForsideFromRepo: () => Promise<void>;

  addInsertIndexRef: MutableRefObject<number | null>;
  setBlockPickerOpen: (open: boolean) => void;

  sensors: ReturnType<typeof import("@dnd-kit/core").useSensors>;
  onDragEndReorder: (event: DragEndEvent) => void;

  canReorderBlocks: boolean;
  onMoveBlock: (blockId: string, delta: number) => void;
  onDuplicateBlock: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;

  selectedBlockId: string | null;
  setSelectedBlockId: (id: string | null) => void;
  hoverBlockId: string | null;
  setHoverBlockId: (id: string | null) => void;
  blockPulseId: string | null;
  newBlockAnimationIds: Set<string>;

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

  title: string;
  onNavigateToGlobalDesignSettings?: () => void;
  pageCmsMetaForPreview: Record<string, unknown>;

  bodyPropertyTitleForCanvas?: string | null;
  bodyPropertyDescriptionForCanvas?: string | null;

  detailBlockInspectorCtx?: BlockInspectorWorkspaceCtx;
  detailWorkspaceInspectorProps?: ContentWorkspacePropertiesRailProps;
  detailSetTitle?: (next: string) => void;

  /** Dokumenttype-/liste-metadata fra shell — valgfritt for tynne canvas-kallere. */
  blockListCreateLabel?: string;
  blockListAddDisabled?: boolean;
  blockPropertyDataTypeAlias?: string | null;
  documentTypeAliasForCanvas?: string | null;
  documentTypeTitleForCanvas?: string | null;
  documentTypeDescriptionForCanvas?: string | null;
  bodyGroupTitleForCanvas?: string | null;
  templateBindingAliasForCanvas?: string | null;

  /** Kun detail-route: struktur vs visuell center-modus (uavhengig av selectedBlockId). */
  detailEditorMode?: ContentDetailEditorMode;
  setDetailEditorMode?: (mode: ContentDetailEditorMode) => void;
};

/* =========================================================
   COMPONENT
========================================================= */

export function WorkspaceBody(props: WorkspaceBodyProps) {
  const {
    bodyMode,
    bodyParseError,
    onConvertLegacyBody,
    onResetInvalidBodyRequest,
    executeResetInvalidBody,
    cancelInvalidBodyReset,
    invalidBodyResetConfirmOpen,

    blocks,
    displayBlocks,

    addInsertIndexRef,
    setBlockPickerOpen,

    canReorderBlocks,
    onMoveBlock,
    onDuplicateBlock,
    onDeleteBlock,

    bodyPropertyTitleForCanvas,
    bodyPropertyDescriptionForCanvas,

    detailBlockInspectorCtx,
    detailWorkspaceInspectorProps,
    detailSetTitle,

    selectedBlockId,
    setSelectedBlockId,
    hoverBlockId,
    setHoverBlockId,
    blocksForLivePreview,
    visualInlineEditApi,
    title,
    pageCmsMetaForPreview,
    detailEditorMode = "structure",
    setDetailEditorMode,
    ..._rest
  } = props;
  void _rest;

  const pathname = usePathname() ?? "";
  const route = resolveBackofficeContentRoute(pathname);
  const isDetailRoute = route.kind === "detail";

  const etRuntime = useElementTypeRuntimeMergedOptional();
  const elementRuntimeMerged = etRuntime?.data?.merged ?? null;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!expandedId) return;
    if (!displayBlocks.some((b) => b.id === expandedId)) {
      setExpandedId(null);
    }
  }, [expandedId, displayBlocks]);

  /* =========================================================
     BLOCK ROWS (UMBRACO PROPERTY)
  ========================================================= */

  const rows = useMemo<UmbracoBlockRow[]>(
    () =>
      displayBlocks.map((block) => {
        const subtitle = isDetailRoute
          ? blockTypeSubtitleForComponentBuilder(block.type, block)
          : blockTypeSubtitle(block.type, block);
        const { statsLine, detailLine } = splitBlockRowSummaryLines(subtitle);
        const baseLine = blockRowComponentLine(block.type);
        const runtime = resolveElementRuntimeLabel(block.type, elementRuntimeMerged);
        const short =
          getBlockTypeDefinition(block.type)?.shortTitle?.trim() || baseLine;
        const catalogLine =
          runtime.trim() !== short.trim()
            ? `Katalog · ${runtime}`
            : (getBlockTypeDefinition(block.type)?.libraryGroup?.trim() ?? `Komponent · ${baseLine}`);
        return {
          id: block.id,
          typeLabel: isDetailRoute ? short : runtime,
          typeKey: block.type,
          componentLine: isDetailRoute ? catalogLine : baseLine,
          statsLine,
          detailLine,
          icon: null,
        };
      }),
    [displayBlocks, elementRuntimeMerged, isDetailRoute],
  );

  function renderBlockField(opts?: { navLayoutCompact?: boolean }) {
    const navLayoutCompact = Boolean(opts?.navLayoutCompact);
    return (
      <UmbracoBlockPropertyField
        variant={isDetailRoute ? "pageBuilder" : "property"}
        navLayoutCompact={navLayoutCompact}
        label={bodyPropertyTitleForCanvas ?? "Hovedinnhold"}
        description={
          bodyPropertyDescriptionForCanvas ??
          (isDetailRoute
            ? navLayoutCompact
              ? "Bytt modul i listen eller i forhåndsvisningen. «Legg til» åpner som før."
              : "Klikk en modul for å sette fokus og åpne innstillinger til høyre."
            : "Valgfrie seksjoner som bygger siden.")
        }
        rows={rows}
        expandedId={expandedId}
        listNavMode={isDetailRoute}
        focusedRowId={isDetailRoute ? selectedBlockId : null}
        onSelectRow={isDetailRoute ? (id) => setSelectedBlockId(id) : undefined}
        onToggleExpand={(id) => {
          if (isDetailRoute) return;
          setExpandedId((prev) => (prev === id ? null : id));
        }}
        onMoveUp={
          canReorderBlocks
            ? (id) => {
                const i = displayBlocks.findIndex((b) => b.id === id);
                if (i > 0) onMoveBlock(id, -1);
              }
            : undefined
        }
        onMoveDown={
          canReorderBlocks
            ? (id) => {
                const i = displayBlocks.findIndex((b) => b.id === id);
                if (i < displayBlocks.length - 1) onMoveBlock(id, 1);
              }
            : undefined
        }
        onDuplicate={onDuplicateBlock}
        onDelete={(id) => {
          onDeleteBlock(id);
          setExpandedId((prev) => (prev === id ? null : prev));
          if (isDetailRoute && selectedBlockId === id) setSelectedBlockId(null);
        }}
        onAdd={() => {
          addInsertIndexRef.current = blocks.length;
          setBlockPickerOpen(true);
        }}
        renderInlineEditor={(id) => {
          if (isDetailRoute) return null;
          const block = displayBlocks.find((b) => b.id === id);
          if (!block || !detailBlockInspectorCtx) return null;

          return (
            <BlockInspectorFields
              block={block}
              ctx={detailBlockInspectorCtx}
              documentSectionEmbedded
            />
          );
        }}
      />
    );
  }

  /**
   * Midtflate: forhåndsvisning / visuell editor når body er blokker.
   * Uten valgt modul: sammen med modul-aside (oversikt). Med valgt modul: eier hele center-workspace (ingen liste i midten).
   */
  function renderDetailEditorMainSurface() {
    if (!isDetailRoute || !detailWorkspaceInspectorProps) return null;

    const slug = detailWorkspaceInspectorProps.slug ?? "";
    const pageSlug = detailWorkspaceInspectorProps.page?.slug ?? null;
    const effectiveId = detailWorkspaceInspectorProps.effectiveId;

    if (bodyMode === "legacy" || bodyMode === "invalid") {
      return (
        <div
          className="flex min-h-0 flex-1 flex-col justify-center rounded-md border border-amber-200/90 bg-amber-50/90 px-3 py-4 text-[13px] text-amber-950"
          data-lp-detail-module-visual-fallback="true"
        >
          {bodyMode === "invalid" ?
            bodyParseError || "Ugyldig body — fiks format for forhåndsvisning."
          : "Konverter body til blokker for å bruke visuell redigeringsflate."}
        </div>
      );
    }

    if (displayBlocks.length === 0) {
      return (
        <div
          className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-md border border-dashed border-slate-300/80 bg-slate-50/90 px-4 py-10 text-center text-[13px] text-slate-600"
          data-lp-detail-editor-main-empty="true"
        >
          Ingen moduler ennå. Bruk «Legg til» i modullisten til venstre.
        </div>
      );
    }

    return (
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white"
        data-lp-detail-editor-main-surface="true"
        data-lp-detail-selected-module-canvas={selectedBlockId ? "true" : undefined}
      >
        <PreviewCanvas
          device="desktop"
          fillContainer
          className="min-h-0 flex-1 rounded-none border-0 shadow-none"
          blocks={blocksForLivePreview}
          title={title}
          meta={{ slug: String(slug || pageSlug || "") }}
          pageCmsMeta={pageCmsMetaForPreview}
          pageId={effectiveId}
          onSelectBlock={(id) => setSelectedBlockId(id)}
          selectedBlockId={selectedBlockId}
          hoverBlockId={hoverBlockId}
          onHoverBlock={(id) => setHoverBlockId(id)}
          visualInlineEdit={visualInlineEditApi}
        />
      </div>
    );
  }

  /* =========================================================
     WARNINGS
  ========================================================= */

  function renderWarnings() {
    if (bodyMode === "legacy") {
      return (
        <div className="p-3 border bg-amber-50 text-sm">
          Legacy body detected
          <button onClick={onConvertLegacyBody}>Convert</button>
        </div>
      );
    }

    if (bodyMode === "invalid") {
      return (
        <div className="p-3 border bg-red-50 text-sm">
          {bodyParseError}
          <button onClick={onResetInvalidBodyRequest}>Reset</button>
        </div>
      );
    }

    return null;
  }

  /* =========================================================
     DETAIL = UMBRACO
  ========================================================= */

  if (isDetailRoute) {
    if (detailWorkspaceInspectorProps && detailSetTitle) {
      const visualCenter = detailEditorMode === "visual";
      const setMode = setDetailEditorMode ?? (() => {});

      function renderDetailStructureCenter() {
        if (bodyMode === "legacy" || bodyMode === "invalid") {
          return (
            <div
              className="flex min-h-0 flex-1 flex-col justify-center rounded-md border border-amber-200/90 bg-amber-50/90 px-3 py-4 text-[13px] text-amber-950"
              data-lp-detail-module-visual-fallback="true"
            >
              {bodyMode === "invalid" ?
                bodyParseError || "Ugyldig body — fiks format for forhåndsvisning."
              : "Konverter body til blokker for å bruke visuell redigeringsflate."}
            </div>
          );
        }
        if (displayBlocks.length === 0) {
          return (
            <div
              className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-md border border-dashed border-slate-300/80 bg-slate-50/90 px-4 py-10 text-center text-[13px] text-slate-600"
              data-lp-detail-editor-main-empty="true"
            >
              Ingen moduler ennå. Bruk «Legg til» under.
            </div>
          );
        }
        return (
          <aside
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-slate-300/80 bg-[#f0f1f4] shadow-sm"
            data-lp-detail-structure-center="true"
            aria-label="Modulstruktur"
          >
            <div className="shrink-0 border-b border-slate-200/85 bg-[#e8eaed] px-2 py-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600">Moduler og rekkefølge</p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-white">
              {renderBlockField({ navLayoutCompact: false })}
            </div>
          </aside>
        );
      }

      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {renderWarnings()}
          <ContentDetailDocumentEditor
            documentFormProps={detailWorkspaceInspectorProps}
            onDocumentTitleChange={detailSetTitle}
            detailEditorMode={detailEditorMode}
            setDetailEditorMode={setMode}
            detailModuleWorkspaceActive={visualCenter}
            blocksSlot={
              visualCenter ?
                <div
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                  data-lp-detail-blocks-slot="true"
                  data-lp-detail-center-mode="visual"
                >
                  <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                    {renderDetailEditorMainSurface()}
                  </div>
                </div>
              : <div
                  className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
                  data-lp-detail-blocks-slot="true"
                  data-lp-detail-center-mode="structure"
                >
                  {renderDetailStructureCenter()}
                </div>

            }
          />
        </div>
      );
    }
    return (
      <div className="min-w-0 space-y-4 py-4">
        {renderWarnings()}
        {renderBlockField()}
      </div>
    );
  }

  /* =========================================================
     BUILDER (fallback)
  ========================================================= */

  return (
    <div className="p-6 text-sm text-slate-500">
      Builder mode disabled in this version
    </div>
  );
}