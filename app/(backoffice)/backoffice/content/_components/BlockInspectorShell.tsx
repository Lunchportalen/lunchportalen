"use client";

import type {
  Block,
  BlockType,
  HeroBlock,
  RichTextBlock,
  ImageBlock,
  CtaBlock,
  DividerBlock,
  BannersBlock,
  CodeBlock,
  BannerItem,
  HeroSuggestion,
  BannerVisualOption,
} from "./editorBlockTypes";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/Icon";
import { getBlockLabel } from "./blockLabels";
import { HeroBlockEditor } from "./editors/HeroBlockEditor";
import { CtaBlockEditor } from "./editors/CtaBlockEditor";
import { ImageBlockEditor } from "./editors/ImageBlockEditor";
import { DividerBlockEditor } from "./editors/DividerBlockEditor";
import { InlineAiActions } from "./InlineAiActions";
import { logEditorAiEvent } from "@/domain/backoffice/ai/metrics/logEditorAiEvent";

export type BlockInspectorValidation = {
  byId: Record<string, string[]>;
  firstId: string | null;
};

type MediaPickerOpen = (args: { blockId: string; itemId?: string; field: "imageUrl" | "videoUrl" | "heroImageUrl" }) => void;

export type BlockInspectorShellProps = {
  blocks: Block[];
  expandedBlockId: string | null;
  onToggleBlock: (blockId: string) => void;
  setBlockById: (blockId: string, updater: (block: Block) => Block) => void;
  blocksValidation: BlockInspectorValidation;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
  onDeleteBlock: (blockId: string) => void;
  setEditOpen: (open: boolean) => void;
  setEditIndex: (index: number | null) => void;
  openMediaPicker: MediaPickerOpen;
  blockTypeSubtitle: (type: BlockType, block?: Block) => string;
  makeBlockId: () => string;
  onAddBlockClick: () => void;
  /** Empty state: forside CTA */
  isForsidePage?: boolean;
  onFillForsideFromRepo?: () => void;
  /** Hero panel */
  heroImageSuggestions?: {
    targetBlockId: string | null;
    items: HeroSuggestion[];
    error: string | null;
    loading: boolean;
  };
  handleHeroImageSuggestions?: (block: HeroBlock) => void;
  applyHeroImageSuggestion?: (blockId: string, suggestion: HeroSuggestion) => void;
  isOffline?: boolean;
  effectiveId?: string | null;
  aiBusyToolId?: string | null;
  handleAiStructuredIntent?: (
    input: { variantCount: number; target: string },
    opts: { fromPanel: boolean }
  ) => void;
  /** Banners panel */
  selectedBannerItemId: string | null;
  setSelectedBannerItemId: (id: string | null) => void;
  bannerPanelTab: "content" | "settings";
  setBannerPanelTab: (tab: "content" | "settings") => void;
  bannerSettingsSubTab: "layout" | "animation" | "advanced";
  setBannerSettingsSubTab: (tab: "layout" | "animation" | "advanced") => void;
  bannerVisualOptions: {
    targetBlockId: string | null;
    targetItemId: string | null;
    options: BannerVisualOption[];
    error: string | null;
  };
  handleBannerVisualOptions: (blockId: string, item: BannerItem) => void;
  /** Fetches alt from media archive. Used by image and hero blocks; returns result for honest error handling. */
  onFetchImageAltFromArchive?: (
    mediaItemId: string
  ) => Promise<{ ok: true; alt: string | null } | { ok: false; error: string }>;
  /** CTA block: verified block-level AI entry. Opens EditorAiShell (improve/shorten/clarify/rewrite, diff, accept/reject). Disabled when aiDisabled. */
  aiDisabled?: boolean;
  onOpenCtaAi?: (blockId: string, block: CtaBlock) => void;
  /** Inline AI actions (Improve, Rewrite, Expand) for text-capable blocks. */
  onInlineAiImprove?: (blockId: string, block: Block) => void;
  onInlineAiRewrite?: (blockId: string, block: Block) => void;
  onInlineAiExpand?: (blockId: string, block: Block) => void;
  inlineAiBusy?: "improve" | "rewrite" | "expand" | null;
  /** Insert AI generated block. Opens flow to describe and insert a single block. */
  onInsertAiBlockClick?: () => void;
};

export function BlockInspectorShell({
  blocks,
  expandedBlockId,
  onToggleBlock,
  setBlockById,
  blocksValidation,
  onMoveBlock,
  onDeleteBlock,
  setEditOpen,
  setEditIndex,
  openMediaPicker,
  blockTypeSubtitle,
  makeBlockId,
  onAddBlockClick,
  isForsidePage,
  onFillForsideFromRepo,
  heroImageSuggestions,
  handleHeroImageSuggestions,
  applyHeroImageSuggestion,
  isOffline,
  effectiveId,
  aiBusyToolId,
  handleAiStructuredIntent,
  selectedBannerItemId,
  setSelectedBannerItemId,
  bannerPanelTab,
  setBannerPanelTab,
  bannerSettingsSubTab,
  setBannerSettingsSubTab,
  bannerVisualOptions,
  handleBannerVisualOptions,
  onFetchImageAltFromArchive,
  aiDisabled,
  onOpenCtaAi,
  onInlineAiImprove,
  onInlineAiRewrite,
  onInlineAiExpand,
  inlineAiBusy = null,
  onInsertAiBlockClick,
}: BlockInspectorShellProps) {
  return (
    <div className="space-y-2">
      {blocks.length === 0 ? (
        <>
          {isForsidePage && onFillForsideFromRepo ? (
            <Card variant="outline" className="rounded-xl p-4">
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
                Denne siden tilsvarer forsiden. Bygg den lik som i repoet med hero, tekster, bilder og CTA-er.
              </p>
              <button
                type="button"
                onClick={onFillForsideFromRepo}
                className="lp-motion-btn mt-3 min-h-[44px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-4 text-sm font-medium text-[rgb(var(--lp-text))] hover:bg-slate-100"
                aria-label="Bygg forside fra repo"
              >
                Bygg forside fra repo
              </button>
            </Card>
          ) : null}
          <div
            className="lp-motion-card flex min-h-[200px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-4 py-8 text-center"
            role="status"
            aria-label="Ingen blokker. Legg til en blokk for å bygge siden."
          >
            <Icon name="add" size="lg" className="mb-3 text-[rgb(var(--lp-muted))]/60" />
            <h3 className="text-sm font-medium text-[rgb(var(--lp-text))]">Ingen blokker ennå</h3>
            <p className="mt-1 max-w-[260px] text-xs text-[rgb(var(--lp-muted))]">
              Legg til din første blokk for å bygge siden. Blokkene vises på nettsiden når du publiserer.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAddBlockClick}
                className="lp-motion-btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border-2 border-[rgb(var(--lp-border))] bg-white px-4 py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] hover:border-slate-400 hover:bg-[rgb(var(--lp-card))]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
                aria-label="Legg til første blokk"
              >
                <Icon name="add" size="sm" />
                Legg til blokk
              </button>
              {onInsertAiBlockClick && !aiDisabled ? (
                <button
                  type="button"
                  onClick={onInsertAiBlockClick}
                  className="lp-motion-btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border-2 border-[rgb(var(--lp-border))] bg-white px-4 py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] hover:border-slate-400 hover:bg-[rgb(var(--lp-card))]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
                  aria-label="Sett inn AI-generert blokk"
                >
                  Sett inn AI-blokk
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : (
        <>
          {blocks.map((block, index) => {
            const open = expandedBlockId === block.id;
            return (
              <article
                key={block.id}
                id={`lp-editor-block-${block.id}`}
                className="border-b border-[rgb(var(--lp-border))] bg-white last:border-b-0"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleBlock(block.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggleBlock(block.id);
                    }
                  }}
                  className="lp-motion-row flex w-full items-center gap-2 px-2 py-2 text-left hover:bg-[rgb(var(--lp-card))]/40"
                >
                  <span className="flex h-8 w-6 shrink-0 items-center justify-center text-[rgb(var(--lp-muted))]" aria-hidden title="Drag handle">
                    ++
                  </span>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--lp-border))] bg-white/80 text-[rgb(var(--lp-muted))] text-[11px] font-medium">
                    {block.type === "hero" ? (
                      <span className="font-bold">H</span>
                    ) : block.type === "richText" ? (
                      <span className="font-mono">&lt;/&gt;</span>
                    ) : block.type === "image" ? (
                      <span>–</span>
                    ) : block.type === "cta" ? (
                      <span className="text-[10px] font-semibold">CTA</span>
                    ) : block.type === "banners" ? (
                      <span>–</span>
                    ) : block.type === "code" ? (
                      <span className="font-mono">&lt;/&gt;</span>
                    ) : (
                      <span>–</span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex shrink-0 items-center rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                        Blokk {index + 1}
                      </span>
                      <span className="truncate text-sm font-medium text-[rgb(var(--lp-text))]">
                        {getBlockLabel(block.type)}
                      </span>
                    </div>
                    <div className="text-[11px] uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                      COMPONENT: {blockTypeSubtitle(block.type, block)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {(block.type === "richText" || block.type === "hero" || block.type === "cta") &&
                    (onInlineAiImprove ?? onInlineAiRewrite ?? onInlineAiExpand) &&
                    !aiDisabled ? (
                      <InlineAiActions
                        onImprove={() => onInlineAiImprove?.(block.id, block)}
                        onRewrite={() => onInlineAiRewrite?.(block.id, block)}
                        onExpand={() => onInlineAiExpand?.(block.id, block)}
                        disabled={!!aiBusyToolId}
                        busyAction={inlineAiBusy}
                      />
                    ) : null}
                    {block.type === "cta" && onOpenCtaAi && !aiDisabled ? (
                      <button
                        type="button"
                        onClick={() => onOpenCtaAi(block.id, block as CtaBlock)}
                        className="min-h-[26px] rounded border border-[rgb(var(--lp-border))] px-2 text-xs hover:bg-[rgb(var(--lp-card))]"
                        title="Forbedre CTA med AI"
                        aria-label="Forbedre med AI"
                      >
                        Forbedre med AI
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setEditIndex(index);
                        setEditOpen(true);
                      }}
                      className="min-h-[26px] rounded border border-[rgb(var(--lp-border))] px-2 text-xs hover:bg-[rgb(var(--lp-card))]"
                      title="Rediger blokk (åpner felter eller JSON)"
                      aria-label="Rediger blokk"
                    >
                      Rediger
                    </button>
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onMoveBlock(block.id, -1)}
                      className="min-h-[26px] rounded border border-[rgb(var(--lp-border))] px-2 text-xs disabled:opacity-40"
                      title="Flytt blokk opp"
                      aria-label="Flytt blokk opp"
                    >
                      +
                    </button>
                    <button
                      type="button"
                      disabled={index === blocks.length - 1}
                      onClick={() => onMoveBlock(block.id, 1)}
                      className="min-h-[26px] rounded border border-[rgb(var(--lp-border))] px-2 text-xs disabled:opacity-40"
                      title="Flytt blokk ned"
                      aria-label="Flytt blokk ned"
                    >
                      –
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteBlock(block.id)}
                      className="min-h-[26px] rounded border border-red-200 bg-red-50 px-2 text-xs text-red-700"
                      title="Slett blokk"
                      aria-label="Slett blokk"
                    >
                      Slett
                    </button>
                  </div>
                  <span className="text-xs text-[rgb(var(--lp-muted))]">{open ? "▼" : "▶"}</span>
                </div>
                {blocksValidation.byId[block.id]?.length ? (
                  <ul className="pl-10 pr-3 pb-1 text-[11px] text-red-700">
                    {blocksValidation.byId[block.id].map((msg, i) => (
                      <li key={i}>• {msg}</li>
                    ))}
                  </ul>
                ) : null}

                {open ? (
                  <div className="border-t border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-3 py-2">
                    <div className="grid gap-2">
                      {block.type === "hero" ? (
                        <HeroBlockEditor
                          block={block}
                          onChange={(next) => setBlockById(block.id, () => next)}
                          onOpenMediaPicker={() => openMediaPicker({ blockId: block.id, field: "heroImageUrl" })}
                          onFetchAltFromArchive={onFetchImageAltFromArchive}
                          suggestions={
                            heroImageSuggestions && heroImageSuggestions.targetBlockId === block.id
                              ? {
                                  items: heroImageSuggestions.items,
                                  loading: heroImageSuggestions.loading,
                                  error: heroImageSuggestions.error,
                                  targetBlockId: block.id,
                                }
                              : undefined
                          }
                          onRequestSuggestions={
                            handleHeroImageSuggestions ? () => handleHeroImageSuggestions(block) : undefined
                          }
                          onApplySuggestion={
                            applyHeroImageSuggestion
                              ? (s) => applyHeroImageSuggestion(block.id, s)
                              : undefined
                          }
                          aiBusy={aiBusyToolId === "experiment.generate.variants"}
                          onGenerateTitle={
                            handleAiStructuredIntent && !isOffline && effectiveId
                              ? () =>
                                  handleAiStructuredIntent(
                                    { variantCount: 2, target: "hero_only" },
                                    { fromPanel: false }
                                  )
                              : undefined
                          }
                          onGenerateCta={
                            handleAiStructuredIntent && !isOffline && effectiveId
                              ? () =>
                                  handleAiStructuredIntent(
                                    { variantCount: 2, target: "hero_cta" },
                                    { fromPanel: false }
                                  )
                              : undefined
                          }
                        />
                      ) : null}

                      {block.type === "richText" ? (
                        <>
                          <label className="grid gap-1 text-sm">
                            <span className="text-[rgb(var(--lp-muted))]">Overskrift</span>
                            <input
                              value={(block as RichTextBlock).heading || ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                setBlockById(block.id, (c) =>
                                  c.type === "richText" ? { ...c, heading: value } : c
                                );
                              }}
                              className="h-10 rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
                            />
                          </label>
                          <label className="grid gap-1 text-sm">
                            <span className="text-[rgb(var(--lp-muted))]">Brødtekst</span>
                            <textarea
                              value={(block as RichTextBlock).body}
                              onChange={(e) => {
                                const value = e.target.value;
                                setBlockById(block.id, (c) =>
                                  c.type === "richText" ? { ...c, body: value } : c
                                );
                              }}
                              className="min-h-32 rounded-lg border border-[rgb(var(--lp-border))] px-3 py-2 text-sm"
                            />
                          </label>
                        </>
                      ) : null}

                      {block.type === "image" ? (
                        <ImageBlockEditor
                          block={block as ImageBlock}
                          onChange={(next) => setBlockById(block.id, () => next)}
                          onOpenMediaPicker={() => openMediaPicker({ blockId: block.id, field: "imageUrl" })}
                          onFetchAltFromArchive={onFetchImageAltFromArchive}
                        />
                      ) : null}

                      {block.type === "cta" ? (
                        <div className="grid gap-2">
                          {onOpenCtaAi && !aiDisabled ? (
                            <div className="flex justify-end">
                              <button
                                type="button"
                                onClick={() => onOpenCtaAi(block.id, block as CtaBlock)}
                                className="min-h-[36px] rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))] focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
                                title="Forbedre CTA med AI"
                                aria-label="Forbedre med AI"
                              >
                                Forbedre med AI
                              </button>
                            </div>
                          ) : null}
                          <CtaBlockEditor
                            block={block as CtaBlock}
                            onChange={(next) => setBlockById(block.id, () => next)}
                          />
                        </div>
                      ) : null}

                      {block.type === "divider" ? (
                        <DividerBlockEditor
                          block={block as DividerBlock}
                          onChange={(next) => setBlockById(block.id, () => next)}
                        />
                      ) : null}

                      {block.type === "banners" ? (
                        <BannersPanel
                          block={block as BannersBlock}
                          setBlockById={setBlockById}
                          openMediaPicker={openMediaPicker}
                          makeBlockId={makeBlockId}
                          selectedBannerItemId={selectedBannerItemId}
                          setSelectedBannerItemId={setSelectedBannerItemId}
                          bannerPanelTab={bannerPanelTab}
                          setBannerPanelTab={setBannerPanelTab}
                          bannerSettingsSubTab={bannerSettingsSubTab}
                          setBannerSettingsSubTab={setBannerSettingsSubTab}
                          bannerVisualOptions={bannerVisualOptions}
                          handleBannerVisualOptions={handleBannerVisualOptions}
                          effectiveId={effectiveId}
                        />
                      ) : null}

                      {block.type === "code" ? (
                        <CodePanel block={block as CodeBlock} setBlockById={setBlockById} />
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onAddBlockClick}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[rgb(var(--lp-border))] bg-white py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] hover:border-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
            >
              <span className="text-lg leading-none">+</span>
              Legg til innhold
            </button>
            {onInsertAiBlockClick && !aiDisabled ? (
              <button
                type="button"
                onClick={onInsertAiBlockClick}
                className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg border-2 border-dashed border-[rgb(var(--lp-border))] bg-white py-2.5 text-sm font-medium text-[rgb(var(--lp-text))] hover:border-[rgb(var(--lp-muted))] hover:bg-[rgb(var(--lp-card))]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--lp-ring))] focus-visible:ring-offset-2"
                aria-label="Sett inn AI-generert blokk"
              >
                Sett inn AI-blokk
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function BannersPanel({
  block,
  setBlockById,
  openMediaPicker,
  makeBlockId,
  selectedBannerItemId,
  setSelectedBannerItemId,
  bannerPanelTab,
  setBannerPanelTab,
  bannerSettingsSubTab,
  setBannerSettingsSubTab,
  bannerVisualOptions,
  handleBannerVisualOptions,
  effectiveId,
}: {
  block: BannersBlock;
  setBlockById: (blockId: string, updater: (block: Block) => Block) => void;
  openMediaPicker: MediaPickerOpen;
  makeBlockId: () => string;
  selectedBannerItemId: string | null;
  setSelectedBannerItemId: (id: string | null) => void;
  bannerPanelTab: "content" | "settings";
  setBannerPanelTab: (tab: "content" | "settings") => void;
  bannerSettingsSubTab: "layout" | "animation" | "advanced";
  setBannerSettingsSubTab: (tab: "layout" | "animation" | "advanced") => void;
  bannerVisualOptions: BlockInspectorShellProps["bannerVisualOptions"];
  handleBannerVisualOptions: (blockId: string, item: BannerItem) => void;
  effectiveId?: string | null;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-[1fr_360px]">
      <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] p-4">
        <p className="mb-2 text-xs font-semibold uppercase text-[rgb(var(--lp-muted))]">Forhåndsvisning</p>
        <div className="space-y-3">
          {block.items.length === 0 ? (
            <p className="text-sm text-[rgb(var(--lp-muted))]">Ingen bannere ennå. Legg til et banner til høyre.</p>
          ) : (
            block.items.map((item) => (
              <div key={item.id} className="rounded-lg border border-[rgb(var(--lp-border))] bg-white">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt="" className="h-32 w-full object-cover" />
                ) : (
                  <div className="flex h-32 w-full items-center justify-center bg-slate-100 text-sm text-[rgb(var(--lp-muted))]">
                    Bilde / video
                  </div>
                )}
                <div className="p-2">
                  <p className="truncate text-sm font-medium text-[rgb(var(--lp-text))]">{item.heading || "—"}</p>
                  <p className="truncate text-xs text-[rgb(var(--lp-muted))]">{item.secondaryHeading || ""}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="rounded-xl border border-[rgb(var(--lp-border))] bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[rgb(var(--lp-text))]">Banner</h3>
          <div className="flex rounded-lg border border-[rgb(var(--lp-border))] p-0.5">
            <button
              type="button"
              onClick={() => setBannerPanelTab("content")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${bannerPanelTab === "content" ? "bg-white text-[rgb(var(--lp-text))] shadow-sm" : "text-[rgb(var(--lp-muted))]"}`}
              title="Content"
            >
              <Icon name="content" size="xs" />
              Content
            </button>
            <button
              type="button"
              onClick={() => setBannerPanelTab("settings")}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium ${bannerPanelTab === "settings" ? "bg-white text-[rgb(var(--lp-text))] shadow-sm" : "text-[rgb(var(--lp-muted))]"}`}
              title="Settings"
            >
              <Icon name="settings" size="xs" />
              Settings
            </button>
          </div>
        </div>
        {bannerPanelTab === "content" ? (
          <>
            <p className="mt-2 text-xs text-[rgb(var(--lp-muted))]">Legg til bannere med bilde/video fra mediearkiv.</p>
            <div className="mt-3 space-y-2">
              {block.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedBannerItemId(selectedBannerItemId === item.id ? null : item.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm ${selectedBannerItemId === item.id ? "border-slate-300 bg-slate-50" : "border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]"}`}
                >
                  <span className="flex-1 truncate">{item.heading || "Banner"}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBlockById(block.id, (c) =>
                        c.type === "banners" ? { ...c, items: c.items.filter((i) => i.id !== item.id) } : c
                      );
                      setSelectedBannerItemId(null);
                    }}
                    className="text-red-600 hover:underline"
                  >
                    Slett
                  </button>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  const id = makeBlockId();
                  setBlockById(block.id, (c) =>
                    c.type === "banners"
                      ? { ...c, items: [...c.items, { id, heading: "", secondaryHeading: "", text: "", buttons: [] }] }
                      : c
                  );
                  setSelectedBannerItemId(id);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] py-3 text-sm font-medium text-[rgb(var(--lp-muted))] hover:border-slate-300 hover:text-[rgb(var(--lp-text))]"
              >
                + Add Banner
              </button>
            </div>
            {selectedBannerItemId &&
              (() => {
                const item = block.items.find((i) => i.id === selectedBannerItemId);
                if (!item) return null;
                return (
                  <div className="mt-4 space-y-3 border-t border-[rgb(var(--lp-border))] pt-4">
                    <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Rediger banner</p>
                    <div>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">Bilde · Fokuspunkt defineres i Media.</p>
                      <button
                        type="button"
                        onClick={() => openMediaPicker({ blockId: block.id, itemId: item.id, field: "imageUrl" })}
                        className="mt-1 flex h-20 w-full items-center justify-center rounded-xl border-2 border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-sm text-[rgb(var(--lp-muted))] hover:border-slate-300"
                      >
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" className="h-full w-full rounded-lg object-cover" />
                        ) : (
                          "Velg fra mediearkiv"
                        )}
                      </button>
                    </div>
                    <div>
                      <p className="text-xs text-[rgb(var(--lp-muted))]">Video (Youtube, Vimeo, MP4)</p>
                      <div className="mt-1 flex gap-2">
                        {(["youtube", "vimeo", "mp4"] as const).map((src) => (
                          <button
                            key={src}
                            type="button"
                            onClick={() =>
                              setBlockById(block.id, (c) =>
                                c.type === "banners"
                                  ? {
                                      ...c,
                                      items: c.items.map((i) =>
                                        i.id === item.id ? { ...i, videoSource: src } : i
                                      ),
                                    }
                                  : c
                              )
                            }
                            className={`rounded px-2 py-1 text-xs font-medium ${item.videoSource === src ? "bg-slate-200 text-slate-900" : "bg-[rgb(var(--lp-card))] text-[rgb(var(--lp-muted))]"}`}
                          >
                            {src.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <div className="mt-1 flex gap-2">
                        <input
                          type="url"
                          placeholder="URL til video"
                          value={item.videoUrl || ""}
                          onChange={(e) =>
                            setBlockById(block.id, (c) =>
                              c.type === "banners"
                                ? {
                                    ...c,
                                    items: c.items.map((i) =>
                                      i.id === item.id ? { ...i, videoUrl: e.target.value } : i
                                    ),
                                  }
                                : c
                            )
                          }
                          className="h-9 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            openMediaPicker({ blockId: block.id, itemId: item.id, field: "videoUrl" })
                          }
                          className="shrink-0 rounded-lg border border-[rgb(var(--lp-border))] px-2 py-1.5 text-xs"
                        >
                          Fra mediearkiv
                        </button>
                      </div>
                    </div>
                    <label className="block">
                      <span className="text-xs text-[rgb(var(--lp-muted))]">Heading</span>
                      <input
                        value={item.heading || ""}
                        onChange={(e) =>
                          setBlockById(block.id, (c) =>
                            c.type === "banners"
                              ? {
                                  ...c,
                                  items: c.items.map((i) =>
                                    i.id === item.id ? { ...i, heading: e.target.value } : i
                                  ),
                                }
                              : c
                          )
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
                        placeholder="Heading goes here"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-[rgb(var(--lp-muted))]">Secondary heading</span>
                      <input
                        value={item.secondaryHeading || ""}
                        onChange={(e) =>
                          setBlockById(block.id, (c) =>
                            c.type === "banners"
                              ? {
                                  ...c,
                                  items: c.items.map((i) =>
                                    i.id === item.id ? { ...i, secondaryHeading: e.target.value } : i
                                  ),
                                }
                              : c
                          )
                        }
                        className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
                        placeholder="Heading goes here"
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs text-[rgb(var(--lp-muted))]">Text</span>
                      <textarea
                        value={item.text || ""}
                        onChange={(e) =>
                          setBlockById(block.id, (c) =>
                            c.type === "banners"
                              ? {
                                  ...c,
                                  items: c.items.map((i) =>
                                    i.id === item.id ? { ...i, text: e.target.value } : i
                                  ),
                                }
                              : c
                          )
                        }
                        rows={3}
                        className="mt-1 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 py-1 text-sm"
                      />
                    </label>
                    <div>
                      <span className="text-xs text-[rgb(var(--lp-muted))]">Buttons</span>
                      <div className="mt-1 space-y-2">
                        {(item.buttons || []).map((btn, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              value={btn.label}
                              onChange={(e) =>
                                setBlockById(block.id, (c) =>
                                  c.type === "banners"
                                    ? {
                                        ...c,
                                        items: c.items.map((i) =>
                                          i.id === item.id
                                            ? {
                                                ...i,
                                                buttons: (i.buttons || []).map((b, j) =>
                                                  j === idx ? { ...b, label: e.target.value } : b
                                                ),
                                              }
                                            : i
                                        ),
                                      }
                                    : c
                                )
                              }
                              className="h-9 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
                              placeholder="Label"
                            />
                            <input
                              value={btn.href}
                              onChange={(e) =>
                                setBlockById(block.id, (c) =>
                                  c.type === "banners"
                                    ? {
                                        ...c,
                                        items: c.items.map((i) =>
                                          i.id === item.id
                                            ? {
                                                ...i,
                                                buttons: (i.buttons || []).map((b, j) =>
                                                  j === idx ? { ...b, href: e.target.value } : b
                                                ),
                                              }
                                            : i
                                        ),
                                      }
                                    : c
                                )
                              }
                              className="h-9 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
                              placeholder="URL"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setBlockById(block.id, (c) =>
                                  c.type === "banners"
                                    ? {
                                        ...c,
                                        items: c.items.map((i) =>
                                          i.id === item.id
                                            ? { ...i, buttons: (i.buttons || []).filter((_, j) => j !== idx) }
                                            : i
                                        ),
                                      }
                                    : c
                                )
                              }
                              className="text-xs text-red-600"
                            >
                              Fjern
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() =>
                            setBlockById(block.id, (c) =>
                              c.type === "banners"
                                ? {
                                    ...c,
                                    items: c.items.map((i) =>
                                      i.id === item.id
                                        ? { ...i, buttons: [...(i.buttons || []), { label: "", href: "" }] }
                                        : i
                                    ),
                                  }
                                : c
                            )
                          }
                          className="rounded-lg border border-dashed border-[rgb(var(--lp-border))] px-3 py-1.5 text-xs"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </>
        ) : (
          <BannerSettingsTab
            block={block}
            selectedBannerItemId={selectedBannerItemId}
            setBlockById={setBlockById}
            bannerSettingsSubTab={bannerSettingsSubTab}
            setBannerSettingsSubTab={setBannerSettingsSubTab}
            bannerVisualOptions={bannerVisualOptions}
            handleBannerVisualOptions={handleBannerVisualOptions}
            effectiveId={effectiveId}
          />
        )}
      </div>
    </div>
  );
}

function BannerSettingsTab({
  block,
  selectedBannerItemId,
  setBlockById,
  bannerSettingsSubTab,
  setBannerSettingsSubTab,
  bannerVisualOptions,
  handleBannerVisualOptions,
  effectiveId,
}: {
  block: BannersBlock;
  selectedBannerItemId: string | null;
  setBlockById: (blockId: string, updater: (block: Block) => Block) => void;
  bannerSettingsSubTab: "layout" | "animation" | "advanced";
  setBannerSettingsSubTab: (tab: "layout" | "animation" | "advanced") => void;
  bannerVisualOptions: BlockInspectorShellProps["bannerVisualOptions"];
  handleBannerVisualOptions: (blockId: string, item: BannerItem) => void;
  effectiveId?: string | null;
}) {
  const item = selectedBannerItemId
    ? block.items.find((i) => i.id === selectedBannerItemId)
    : null;
  if (!selectedBannerItemId) {
    return (
      <p className="mt-3 text-sm text-[rgb(var(--lp-muted))]">
        Velg et banner i listen for å redigere innstillinger.
      </p>
    );
  }
  if (!item) return null;
  const update = (patch: Partial<BannerItem>) =>
    setBlockById(block.id, (c) =>
      c.type === "banners"
        ? { ...c, items: c.items.map((i) => (i.id === item.id ? { ...i, ...patch } : i)) }
        : c
    );
  return (
    <div className="mt-3">
      <div className="flex gap-1 border-b border-[rgb(var(--lp-border))]">
        {(["layout", "animation", "advanced"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setBannerSettingsSubTab(tab)}
            className={`px-3 py-2 text-xs font-medium capitalize ${bannerSettingsSubTab === tab ? "border-b-2 border-slate-600 text-slate-900" : "text-[rgb(var(--lp-muted))]"}`}
          >
            {tab === "layout" ? "Layout" : tab === "animation" ? "Animation" : "Advanced"}
          </button>
        ))}
      </div>
      {bannerSettingsSubTab === "layout" ? (
        <div className="space-y-4 pt-3">
          <div>
            <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Banner style</p>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {(["takeover", "medium", "short", "scale"] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  onClick={() => update({ bannerStyle: style })}
                  className={`rounded-lg border p-2 text-center text-xs font-medium ${item.bannerStyle === style ? "border-slate-400 bg-slate-100 text-slate-900" : "border-[rgb(var(--lp-border))]"}`}
                >
                  {style.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Background color</p>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                placeholder="Farge"
                value={item.backgroundColor || ""}
                onChange={(e) => update({ backgroundColor: e.target.value })}
                className="h-9 flex-1 rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
              />
              <input
                type="color"
                value={
                  item.backgroundColor && /^#[0-9A-Fa-f]{6}$/.test(item.backgroundColor)
                    ? item.backgroundColor
                    : "#fbbf24"
                }
                onChange={(e) => update({ backgroundColor: e.target.value })}
                className="h-9 w-10 cursor-pointer rounded border border-[rgb(var(--lp-border))]"
              />
            </div>
            <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Secondary heading / body text color</p>
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">AI bakgrunn</p>
                <button
                  type="button"
                  onClick={() => handleBannerVisualOptions(block.id, item)}
                  className="rounded border border-[rgb(var(--lp-border))] px-2 py-1 text-[10px] font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
                >
                  Foreslå alternativer
                </button>
              </div>
              {bannerVisualOptions.targetBlockId === block.id &&
                bannerVisualOptions.targetItemId === item.id &&
                bannerVisualOptions.error && (
                  <p className="text-[10px] text-red-600">{bannerVisualOptions.error}</p>
                )}
              {bannerVisualOptions.targetBlockId === block.id &&
                bannerVisualOptions.targetItemId === item.id &&
                bannerVisualOptions.options.length > 0 && (
                  <div className="mt-1 grid gap-1.5">
                    {bannerVisualOptions.options.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          const changes = opt.changes;
                          update({
                            bannerStyle: (changes.bannerStyle ?? item.bannerStyle) as BannerItem["bannerStyle"],
                            backgroundColor: (changes.backgroundColor ?? item.backgroundColor) as
                              | BannerItem["backgroundColor"]
                              | undefined,
                            textAlignment: (changes.textAlignment ?? item.textAlignment) as
                              | BannerItem["textAlignment"]
                              | undefined,
                            textPosition: (changes.textPosition ?? item.textPosition) as
                              | BannerItem["textPosition"]
                              | undefined,
                            scrollPrompt: (changes.scrollPrompt ?? item.scrollPrompt) as
                              | BannerItem["scrollPrompt"]
                              | undefined,
                          });
                          logEditorAiEvent({
                            type: "ai_patch_applied",
                            feature: "visual_options",
                            pageId: effectiveId ?? null,
                            variantId: null,
                            timestamp: new Date().toISOString(),
                          });
                        }}
                        className="flex flex-col rounded-lg border border-[rgb(var(--lp-border))] px-2 py-1.5 text-left text-[10px] hover:bg-slate-50"
                      >
                        <span className="text-[10px] font-semibold text-[rgb(var(--lp-text))]">
                          {opt.label}
                        </span>
                        <span className="text-[10px] text-[rgb(var(--lp-muted))]">{opt.summary}</span>
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[rgb(var(--lp-text))]">Scroll prompt</span>
            <button
              type="button"
              onClick={() => update({ scrollPrompt: !item.scrollPrompt })}
              className={`lp-motion-switch relative h-6 w-11 rounded-full border ${item.scrollPrompt ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}
            >
              <span
                className={`lp-motion-switch-thumb absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${item.scrollPrompt ? "left-5" : "left-0.5"}`}
              />
            </button>
            <span className="text-xs text-[rgb(var(--lp-muted))]">{item.scrollPrompt ? "YES" : "NO"}</span>
          </div>
          <div>
            <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Text alignment</p>
            <div className="mt-1 flex gap-2">
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onClick={() => update({ textAlignment: align })}
                  className={`rounded px-2 py-1 text-xs font-medium ${item.textAlignment === align ? "bg-slate-200 text-slate-900" : "bg-[rgb(var(--lp-card))]"}`}
                >
                  {align.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold text-[rgb(var(--lp-muted))]">Text position</p>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {[
                "top-left",
                "top-center",
                "top-right",
                "middle-left",
                "center",
                "middle-right",
                "bottom-left",
                "bottom-center",
                "bottom-right",
              ].map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => update({ textPosition: pos })}
                  className={`rounded border p-1.5 text-[10px] ${item.textPosition === pos ? "border-slate-400 bg-slate-100" : "border-[rgb(var(--lp-border))]"}`}
                >
                  {pos.replace("-", " ")}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[rgb(var(--lp-text))]">Apply image opacity</span>
            <button
              type="button"
              onClick={() => update({ imageOpacity: !item.imageOpacity })}
              className={`lp-motion-switch relative h-6 w-11 rounded-full border ${item.imageOpacity ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}
            >
              <span
                className={`lp-motion-switch-thumb absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${item.imageOpacity ? "left-5" : "left-0.5"}`}
              />
            </button>
            <span className="text-xs text-[rgb(var(--lp-muted))]">{item.imageOpacity ? "YES" : "NO"}</span>
          </div>
        </div>
      ) : bannerSettingsSubTab === "animation" ? (
        <div className="pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[rgb(var(--lp-text))]">Animate</span>
            <button
              type="button"
              onClick={() => update({ animate: !item.animate })}
              className={`lp-motion-switch relative h-6 w-11 rounded-full border ${item.animate ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}
            >
              <span
                className={`lp-motion-switch-thumb absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${item.animate ? "left-5" : "left-0.5"}`}
              />
            </button>
            <span className="text-xs text-[rgb(var(--lp-muted))]">{item.animate ? "YES" : "NO"}</span>
          </div>
        </div>
      ) : (
        <div className="space-y-4 pt-3">
          <label className="block">
            <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">Name</span>
            <input
              value={item.name || ""}
              onChange={(e) => update({ name: e.target.value })}
              className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">Anchor name</span>
            <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
              Unik anker som kan brukes for å lenke til denne komponenten. Mellomrom blir til &#39;-&#39;.
            </p>
            <input
              value={item.anchorName || ""}
              onChange={(e) => update({ anchorName: e.target.value })}
              className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
              placeholder="anker-navn"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-[rgb(var(--lp-text))]">Custom classes</span>
            <p className="mt-0.5 text-xs text-[rgb(var(--lp-muted))]">
              Egne CSS-klasser. Mellomrom mellom hver, f.eks. min-klasse annen-klasse
            </p>
            <input
              value={item.customClasses || ""}
              onChange={(e) => update({ customClasses: e.target.value })}
              className="mt-1 h-9 w-full rounded-lg border border-[rgb(var(--lp-border))] px-2 text-sm"
              placeholder="klasse1 klasse2"
            />
          </label>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[rgb(var(--lp-text))]">Hide from website</span>
            <button
              type="button"
              onClick={() => update({ hideFromWebsite: !item.hideFromWebsite })}
              className={`lp-motion-switch relative h-6 w-11 rounded-full border ${item.hideFromWebsite ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}
            >
              <span
                className={`lp-motion-switch-thumb absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${item.hideFromWebsite ? "left-5" : "left-0.5"}`}
              />
            </button>
            <span className="text-xs text-[rgb(var(--lp-muted))]">
              {item.hideFromWebsite ? "YES" : "NO"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function CodePanel({
  block,
  setBlockById,
}: {
  block: CodeBlock;
  setBlockById: (blockId: string, updater: (block: Block) => Block) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-[rgb(var(--lp-text))]">Code</span>
        <button
          type="button"
          onClick={() => {
            const html = block.code?.trim() || "";
            const doc = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;
            const w = typeof window !== "undefined" ? window.open("", "_blank", "noopener,width=900,height=700") : null;
            if (w) {
              w.document.write(doc);
              w.document.close();
            }
          }}
          className="rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-slate-50"
        >
          Å forhåndsvisning i nytt vindu
        </button>
      </div>
      <div className="flex gap-1 border-b border-[rgb(var(--lp-border))]">
        <span className="border-b-2 border-slate-600 px-3 py-2 text-xs font-medium text-slate-900">Code</span>
        <span className="px-3 py-2 text-xs text-[rgb(var(--lp-muted))]">Content</span>
        <span className="px-3 py-2 text-xs text-[rgb(var(--lp-muted))]">Settings</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[rgb(var(--lp-muted))]">Display intro</span>
        <button
          type="button"
          onClick={() =>
            setBlockById(block.id, (c) =>
              c.type === "code" ? { ...c, displayIntro: !c.displayIntro } : c
            )
          }
          className={`lp-motion-switch relative h-6 w-11 rounded-full border ${block.displayIntro ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}
        >
          <span
            className={`lp-motion-switch-thumb absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${block.displayIntro ? "left-5" : "left-0.5"}`}
          />
        </button>
        <span className="text-xs text-[rgb(var(--lp-muted))]">{block.displayIntro ? "YES" : "NO"}</span>
      </div>
      <label className="block">
        <span className="text-xs text-[rgb(var(--lp-muted))]">
          Enter your raw code here. This can be JavaScript, HTML etc.
        </span>
        <textarea
          value={block.code}
          onChange={(e) => setBlockById(block.id, (c) => (c.type === "code" ? { ...c, code: e.target.value } : c))}
          rows={12}
          className="mt-1 w-full rounded-lg border border-[rgb(var(--lp-border))] bg-white p-2 font-mono text-xs"
          placeholder="<div>...</div>"
        />
      </label>
      <div className="flex gap-2">
        <button type="button" className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-1.5 text-xs font-medium">
          RUN CODE
        </button>
        <button type="button" className="rounded-lg border border-[rgb(var(--lp-border))] px-3 py-1.5 text-xs font-medium">
          DISPLAY CODE
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-[rgb(var(--lp-muted))]">Display outro</span>
        <button
          type="button"
          onClick={() =>
            setBlockById(block.id, (c) =>
              c.type === "code" ? { ...c, displayOutro: !c.displayOutro } : c
            )
          }
          className={`lp-motion-switch relative h-6 w-11 rounded-full border ${block.displayOutro ? "border-slate-500 bg-slate-300" : "border-[rgb(var(--lp-border))] bg-slate-100"}`}
        >
          <span
            className={`lp-motion-switch-thumb absolute top-0.5 h-5 w-5 rounded-full bg-white shadow ${block.displayOutro ? "left-5" : "left-0.5"}`}
          />
        </button>
        <span className="text-xs text-[rgb(var(--lp-muted))]">{block.displayOutro ? "YES" : "NO"}</span>
      </div>
    </div>
  );
}
