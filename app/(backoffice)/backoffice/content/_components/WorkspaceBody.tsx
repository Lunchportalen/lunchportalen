"use client";

import { Fragment, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { DndContext, closestCenter, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { BlockCard, BlockPreview, EditorSmartHintsBanner, SortableBlockWrapper } from "@/components/cms";
import { editorCanvasFrameKind } from "@/components/cms/blockCanvas";
import {
  CardsCanvasFrame,
  CtaCanvasFrame,
  DefaultCanvasFrame,
  GridCanvasFrame,
  HeroCanvasFrame,
  PricingCanvasFrame,
  RelatedCanvasFrame,
  StepsCanvasFrame,
} from "@/components/cms/blockCanvas/frames";
import { PageContainer } from "@/components/layout/PageContainer";
import { DsButton } from "@/components/ui/ds";
import { resolveElementRuntimeLabel } from "./blockLabels";
import { useElementTypeRuntimeMergedOptional } from "./ElementTypeRuntimeMergedContext";
import type { PublicPageVisualInlineEdit } from "./PreviewCanvas";
import type { HistoryPreviewPayload } from "./ContentPageVersionHistory";
import type { Block } from "./editorBlockTypes";
import { blockTypeSubtitle, type BodyMode } from "./contentWorkspace.blocks";

function defaultCanvasSurface(
  block: Block,
): "richText" | "image" | "divider" | "form" | "banner" | "other" {
  switch (block.type) {
    case "richText":
      return "richText";
    case "image":
      return "image";
    case "divider":
      return "divider";
    case "form":
      return "form";
    case "banner":
      return "banner";
    default:
      return "other";
  }
}

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
  title: string;
  onNavigateToGlobalDesignSettings?: () => void;
  pageCmsMetaForPreview: Record<string, unknown>;
  /** U94 — Block Editor Data Type → create CTA label */
  blockListCreateLabel?: string;
  blockListAddDisabled?: boolean;
  blockPropertyDataTypeAlias?: string | null;
  /** U96 — Document Type / Property Type → editor (fra merged schema) */
  documentTypeAliasForCanvas?: string | null;
  documentTypeTitleForCanvas?: string | null;
  documentTypeDescriptionForCanvas?: string | null;
  bodyPropertyTitleForCanvas?: string | null;
  bodyPropertyDescriptionForCanvas?: string | null;
  bodyGroupTitleForCanvas?: string | null;
  templateBindingAliasForCanvas?: string | null;
};

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
    title,
    onNavigateToGlobalDesignSettings,
    pageCmsMetaForPreview,
    blockListCreateLabel = "Legg til innhold",
    blockListAddDisabled = false,
    blockPropertyDataTypeAlias = null,
    documentTypeAliasForCanvas = null,
    documentTypeTitleForCanvas = null,
    documentTypeDescriptionForCanvas = null,
    bodyPropertyTitleForCanvas = null,
    bodyPropertyDescriptionForCanvas = null,
    bodyGroupTitleForCanvas = null,
    templateBindingAliasForCanvas = null,
  } = props;

  const etRuntime = useElementTypeRuntimeMergedOptional();
  const elementRuntimeMerged = etRuntime?.data?.merged ?? null;

  const selectedBlockForBar =
    selectedBlockId != null ? displayBlocks.find((block) => block.id === selectedBlockId) ?? null : null;
  const showBlocks = bodyMode === "blocks";
  const resolvedTemplateBindingAlias = (() => {
    const candidate =
      templateBindingAliasForCanvas ??
      pageCmsMetaForPreview?.template ??
      pageCmsMetaForPreview?.templateAlias ??
      pageCmsMetaForPreview?.rendering ??
      pageCmsMetaForPreview?.renderingAlias;
    return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
  })();

  return (
    <motion.div
      key="workspace-editor-body"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="min-w-0"
    >
      <div className="min-w-0 space-y-4">
        <section className="rounded-xl border border-[rgb(var(--lp-border))]/70 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex flex-col gap-2 border-b border-[rgb(var(--lp-border))]/70 pb-3 sm:flex-row sm:items-start sm:justify-between">
            <div data-lp-document-type-canvas-header data-lp-property-alias="body">
              <h2
                className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]"
                data-lp-document-type-property-group
                data-lp-document-type-group
              >
                {bodyGroupTitleForCanvas ?? "Arbeidsflate · body"}
              </h2>
              <p
                className="mt-1 text-xs font-medium text-[rgb(var(--lp-text))]"
                data-lp-document-type-property-title
                data-lp-property-title
              >
                {bodyPropertyTitleForCanvas ?? "Blokker på siden"}
              </p>
              {bodyPropertyDescriptionForCanvas ? (
                <p
                  className="mt-1 text-xs leading-snug text-[rgb(var(--lp-muted))]"
                  data-lp-document-type-property-description
                  data-lp-property-description
                >
                  {bodyPropertyDescriptionForCanvas}
                </p>
              ) : (
                <p className="mt-1 text-xs leading-snug text-[rgb(var(--lp-muted))]">
                  Canvas viser struktur og blokkspesifikk forhåndsvisning. Egenskaper redigeres i inspektoren som
                  egenskapseditor — ikke som generiske skjemarader her.
                </p>
              )}
              {documentTypeAliasForCanvas ? (
                <p className="mt-2 text-[10px] text-[rgb(var(--lp-muted))]">
                  <span data-lp-document-type-alias>{documentTypeAliasForCanvas}</span>
                  {documentTypeTitleForCanvas ? (
                    <>
                      {" "}
                      · <span data-lp-document-type-title>{documentTypeTitleForCanvas}</span>
                    </>
                  ) : null}
                </p>
              ) : null}
              {documentTypeDescriptionForCanvas ? (
                <p className="mt-0.5 text-[10px] leading-snug text-[rgb(var(--lp-muted))]/90">
                  {documentTypeDescriptionForCanvas}
                </p>
              ) : null}
              <p
                className="mt-0.5 text-[10px] leading-snug text-[rgb(var(--lp-muted))]/90"
                data-lp-template-binding
              >
                Rendering:{" "}
                <span data-lp-template-binding-alias={resolvedTemplateBindingAlias ?? ""}>
                  {resolvedTemplateBindingAlias?.trim() ? resolvedTemplateBindingAlias : "—"}
                </span>
              </p>
            </div>
            <div className="rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/35 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
              Arbeidsflate
            </div>
          </div>

          <div className="mb-3 rounded-lg border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/22 p-2.5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                  Designfokus
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[rgb(var(--lp-muted))]">
                  Valgt blokk og sidekontekst i samme workspace.
                </p>
              </div>
              <div className="rounded-md border border-[rgb(var(--lp-border))] bg-white px-2.5 py-1 text-[11px] font-semibold text-[rgb(var(--lp-text))]">
                {selectedBlockForBar ? (
                  <span data-lp-element-type-alias={selectedBlockForBar.type} data-lp-element-type-title>
                    {resolveElementRuntimeLabel(selectedBlockForBar.type, elementRuntimeMerged)}
                  </span>
                ) : (
                  title.trim() || "Ingen blokk valgt"
                )}
              </div>
            </div>
            {onNavigateToGlobalDesignSettings ? (
              <button
                type="button"
                onClick={onNavigateToGlobalDesignSettings}
                className="mt-3 min-h-10 rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]/60"
              >
                Åpne designinnstillinger
              </button>
            ) : null}
          </div>

          {bodyMode === "legacy" ? (
            <div className="mb-4 space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <p>Legacy body detected. Convert to blocks to use builder.</p>
              <button
                type="button"
                onClick={onConvertLegacyBody}
                className="min-h-[36px] rounded-lg border border-amber-300 bg-white px-3 text-sm font-medium"
              >
                Convert to blocks
              </button>
            </div>
          ) : null}

          {bodyMode === "invalid" ? (
            <div className="mb-4 space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p>{bodyParseError || "Invalid body format."}</p>
              {!invalidBodyResetConfirmOpen ? (
                <button
                  type="button"
                  onClick={onResetInvalidBodyRequest}
                  className="min-h-[36px] rounded-lg border border-red-300 bg-white px-3 text-sm font-medium"
                >
                  Reset to blocks
                </button>
              ) : (
                <div
                  role="group"
                  aria-label="Bekreft reset av body"
                  className="flex flex-col gap-2 rounded-lg border border-red-300 bg-white p-3 text-red-900"
                >
                  <p className="text-sm font-medium">
                    Reset body til blokker? Dette kan ikke angres. Er du sikker?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={executeResetInvalidBody}
                      className="min-h-[40px] rounded-lg border border-red-600 bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Ja
                    </button>
                    <button
                      type="button"
                      onClick={cancelInvalidBodyReset}
                      className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Avbryt
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {showBlocks ? (
            <PageContainer maxWidth="content" className="space-y-4">
              <EditorSmartHintsBanner blocks={blocks} />

              {displayBlocks.length === 0 ? (
                <>
                  {isForsidePage() ? (
                    <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-slate-50/90 p-5 shadow-sm">
                      <p className="text-sm font-medium leading-relaxed text-[rgb(var(--lp-text))]">
                        Denne siden tilsvarer forsiden. Ett klikk fyller ut hero full, verdikort, steg, priser, tillitsrutenett, avsluttende CTA og relaterte sider.
                      </p>
                      <DsButton
                        variant="ghost"
                        type="button"
                        disabled={buildHomeFromRepoBusy || isOffline}
                        onClick={() => void onFillForsideFromRepo()}
                        className="mt-4 min-h-[44px] border border-[rgb(var(--lp-border))] bg-white px-4 shadow-sm hover:-translate-y-px hover:shadow-md"
                        aria-label="Bygg forside fra repo"
                        aria-busy={buildHomeFromRepoBusy}
                      >
                        {buildHomeFromRepoBusy ? "Bygger ..." : "Bygg forside fra repo"}
                      </DsButton>
                    </div>
                  ) : null}

                  <div className="py-10 text-center md:py-12">
                    <h2 className="text-base font-semibold text-[rgb(var(--lp-text))]">Start med en seksjon</h2>
                    <p className="mt-1.5 text-xs text-[rgb(var(--lp-muted))]">
                      Legg til en blokk for å starte den kanoniske redigeringsrekken.
                    </p>
                    <DsButton
                      variant="secondary"
                      type="button"
                      className="mt-5 min-h-[44px] text-sm font-semibold"
                      onClick={() => {
                        addInsertIndexRef.current = blocks.length;
                        setBlockPickerOpen(true);
                      }}
                    >
                      <span className="text-lg leading-none" aria-hidden>
                        +
                      </span>{" "}
                      Legg til første blokk
                    </DsButton>
                  </div>
                </>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEndReorder}>
                  <SortableContext items={displayBlocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
                    {displayBlocks.map((block, index) => {
                      const open = selectedBlockId === block.id;
                      const canvasFrameKind = editorCanvasFrameKind(block);
                      const blockCardChrome = canvasFrameKind === "default" ? "shell" : "frame";

                      return (
                        <Fragment key={block.id}>
                          <div
                            data-lp-insert-slot
                            className="group/ins relative flex h-6 items-center justify-center py-0.5"
                          >
                            <div
                              className="pointer-events-none absolute inset-x-6 h-px bg-[rgb(var(--lp-border))]/50 transition-colors group-hover/ins:bg-pink-400/35"
                              aria-hidden
                            />
                            <button
                              type="button"
                              onClick={() => {
                                addInsertIndexRef.current = index;
                                setBlockPickerOpen(true);
                              }}
                              className="relative z-[1] flex min-h-8 min-w-8 items-center justify-center rounded-full border border-[rgb(var(--lp-border))]/70 bg-white text-xs font-semibold text-[rgb(var(--lp-muted))] opacity-50 shadow-sm transition-all duration-200 hover:scale-105 hover:border-pink-400/50 hover:text-[rgb(var(--lp-text))] hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/35 group-hover/ins:opacity-100"
                              aria-label={`Sett inn ny blokk på posisjon ${index + 1}`}
                            >
                              <span aria-hidden>+</span>
                            </button>
                          </div>

                          <SortableBlockWrapper id={block.id} disabled={!canReorderBlocks}>
                            {(dragHandleProps) => (
                              <motion.div
                                initial={newBlockAnimationIds.has(block.id) ? { y: 20, opacity: 0 } : false}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                className="will-change-transform"
                              >
                                <BlockCard
                                  domId={`lp-editor-block-${block.id}`}
                                  blockId={block.id}
                                  tabIndex={selectedBlockId === block.id ? 0 : -1}
                                  selected={selectedBlockId === block.id}
                                  hoverSync={hoverBlockId === block.id}
                                  pulse={blockPulseId === block.id}
                                  chrome={blockCardChrome}
                                  onMouseEnter={() => setHoverBlockId(block.id)}
                                  onMouseLeave={() => setHoverBlockId(null)}
                                  className="mb-8 last:mb-2"
                                >
                                  {(() => {
                                    const frameKind = canvasFrameKind;
                                    const activateBlock = () => {
                                      setSelectedBlockId(block.id);
                                    };

                                    const collapsedPreview = <BlockPreview block={block} />;
                                    const subtitleWhenOpen = open ? blockTypeSubtitle(block.type, block) : null;
                                    const frameProps = {
                                      block,
                                      index,
                                      open,
                                      canReorderBlocks,
                                      dragHandleProps,
                                      collapsedBody: collapsedPreview,
                                      onActivateCollapsed: activateBlock,
                                      onMoveUp: () => onMoveBlock(block.id, -1),
                                      onMoveDown: () => onMoveBlock(block.id, 1),
                                      onDuplicate: () => onDuplicateBlock(block.id),
                                      onEdit: () => {
                                        setEditIndex(index);
                                        setEditOpen(true);
                                      },
                                      onDelete: () => onDeleteBlock(block.id),
                                      disabledMoveUp: index === 0,
                                      disabledMoveDown: index === displayBlocks.length - 1,
                                      subtitleWhenOpen,
                                    };

                                    switch (frameKind) {
                                      case "hero":
                                        return <HeroCanvasFrame {...frameProps} />;
                                      case "cards":
                                        return <CardsCanvasFrame {...frameProps} />;
                                      case "steps":
                                        return <StepsCanvasFrame {...frameProps} />;
                                      case "pricing":
                                        return <PricingCanvasFrame {...frameProps} />;
                                      case "cta":
                                        return <CtaCanvasFrame {...frameProps} />;
                                      case "related":
                                        return <RelatedCanvasFrame {...frameProps} />;
                                      case "grid":
                                        return <GridCanvasFrame {...frameProps} />;
                                      default:
                                        return (
                                          <DefaultCanvasFrame
                                            {...frameProps}
                                            surface={defaultCanvasSurface(block)}
                                          />
                                        );
                                    }
                                  })()}

                                  <div
                                    className={`grid overflow-clip transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                                  >
                                    <div className="min-h-0">
                                      {open ? (
                                        <motion.div
                                          initial={{ opacity: 0.6, scale: 0.98 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ duration: 0.18 }}
                                          className="origin-top will-change-[opacity,transform]"
                                        >
                                          <div className="border-t border-pink-200/45 bg-gradient-to-b from-pink-50/30 to-white px-2.5 py-3">
                                            <p className="text-center text-[11px] font-medium leading-snug text-pink-950/85">
                                              Redigering skjer i egenskapseditoren til høyre — ett datasett per blokk, ingen
                                              skjemafelter i canvas.
                                            </p>
                                            <div
                                              className="mt-3 max-h-[min(360px,45vh)] overflow-auto rounded-xl border border-slate-200/85 bg-white p-2 shadow-inner"
                                              data-lp-canvas-selected-scan
                                            >
                                              <BlockPreview block={block} />
                                            </div>
                                          </div>
                                        </motion.div>
                                      ) : null}
                                    </div>
                                  </div>

                                  {selectedBlockId === block.id && block.type === "richText" ? (
                                    <div className="animate-fade-in mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 transition-all duration-150 ease-out">
                                      <div className="mb-1 text-xs font-semibold text-rose-700">AI forslag</div>
                                      {aiSuggestLoading ? (
                                        <div className="text-sm text-gray-700">Jobber...</div>
                                      ) : aiSuggestion ? (
                                        <>
                                          <div className="text-sm text-gray-800">{aiSuggestion}</div>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const suggestion = aiSuggestion;
                                              if (!suggestion) return;
                                              setBlockById(block.id, (current) => {
                                                if (current.type === "richText") return { ...current, body: suggestion };
                                                return current;
                                              });
                                              setAiSuggestion(null);
                                            }}
                                            className="mt-2 text-xs font-medium text-rose-700 transition-all duration-150 ease-out hover:underline"
                                          >
                                            Bruk forslag
                                          </button>
                                        </>
                                      ) : (
                                        <div className="text-sm text-gray-700">Ingen forslag enda</div>
                                      )}

                                      {aiScore !== null ? (
                                        <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                                          <div className="text-xs font-semibold text-gray-500">AI score</div>
                                          <div className="text-lg font-bold">{aiScore}/100</div>
                                          {aiHints.length > 0 ? (
                                            <ul className="ml-4 mt-1 list-disc text-xs text-gray-700">
                                              {aiHints.map((hint, hintIndex) => (
                                                <li key={hintIndex}>{hint}</li>
                                              ))}
                                            </ul>
                                          ) : null}
                                        </div>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {selectedBlockId === block.id &&
                                  (block.type === "hero" || block.type === "image") &&
                                  aiImageLoading ? (
                                    <div className="mt-2 animate-fade-in">
                                      <div className="h-40 animate-pulse rounded bg-gray-200" />
                                    </div>
                                  ) : null}
                                </BlockCard>
                              </motion.div>
                            )}
                          </SortableBlockWrapper>
                        </Fragment>
                      );
                    })}
                  </SortableContext>
                </DndContext>
              )}

              {blockPropertyDataTypeAlias ? (
                <div
                  className="mx-auto mt-1 w-full max-w-2xl rounded-lg border border-[rgb(var(--lp-border))]/80 bg-[rgb(var(--lp-card))]/40 px-3 py-2 text-center text-[11px] text-[rgb(var(--lp-muted))]"
                  data-lp-canvas-block-property-binding
                >
                  <span className="font-medium text-[rgb(var(--lp-text))]/90">Blokkegenskaper</span> · Data type{" "}
                  <span data-lp-block-editor-data-type-canvas>{blockPropertyDataTypeAlias}</span> ·{" "}
                  <span data-lp-block-property-binding>
                    property <code className="rounded bg-white/80 px-1 py-0.5 text-[10px]">body.blocks</code>
                    {bodyPropertyTitleForCanvas ? <> · {bodyPropertyTitleForCanvas}</> : null}
                  </span>
                </div>
              ) : null}
              <button
                type="button"
                data-lp-insert-end
                data-lp-block-list-create-label={blockListCreateLabel}
                data-lp-block-list-at-max={blockListAddDisabled ? "true" : "false"}
                disabled={blockListAddDisabled}
                aria-disabled={blockListAddDisabled}
                onClick={() => {
                  if (blockListAddDisabled) return;
                  addInsertIndexRef.current = blocks.length;
                  setBlockPickerOpen(true);
                }}
                className="mx-auto mt-2 flex min-h-10 w-full max-w-2xl items-center justify-center gap-2 rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-white py-2 text-sm font-semibold text-[rgb(var(--lp-text))] shadow-sm transition-colors hover:border-pink-400/40 hover:bg-[rgb(var(--lp-card))]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="text-base leading-none" aria-hidden>
                  +
                </span>
                {blockListCreateLabel}
              </button>
            </PageContainer>
          ) : null}
        </section>
      </div>
    </motion.div>
  );
}
