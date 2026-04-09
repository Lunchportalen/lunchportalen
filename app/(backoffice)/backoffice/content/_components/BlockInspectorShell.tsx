"use client";

/**
 * U82B: Block list navigator only — ordering, selection, validation surface, AI shortcuts.
 * Canonical property editing lives in ContentWorkspacePropertiesRail + BlockInspectorFields (one path).
 */

import type { Dispatch, SetStateAction } from "react";
import type { Block, BlockType, CtaBlock } from "./editorBlockTypes";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/Icon";
import { resolveElementRuntimeLabel } from "./blockLabels";
import { useElementTypeRuntimeMergedOptional } from "./ElementTypeRuntimeMergedContext";
import { BlockTypeIcon } from "./BlockTypeIcon";
import { InlineAiActions } from "./InlineAiActions";

export type BlockInspectorValidation = {
  byId: Record<string, string[]>;
  firstId: string | null;
};

export type BlockInspectorShellProps = {
  blocks: Block[];
  /** Single canonical focus id for list + inspector + canvas (U82B). */
  selectedBlockId: string | null;
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>;
  blocksValidation: BlockInspectorValidation;
  onMoveBlock: (blockId: string, direction: -1 | 1) => void;
  onDeleteBlock: (blockId: string) => void;
  setEditOpen: (open: boolean) => void;
  setEditIndex: (index: number | null) => void;
  blockTypeSubtitle: (type: BlockType, block?: Block) => string;
  onAddBlockClick: () => void;
  /** Empty state: forside CTA */
  isForsidePage?: boolean;
  onFillForsideFromRepo?: () => void | Promise<void>;
  aiBusyToolId?: string | null;
  /** CTA block: opens EditorAiShell. Disabled when aiDisabled. */
  aiDisabled?: boolean;
  onOpenCtaAi?: (blockId: string, block: CtaBlock) => void;
  /** Shortcut actions; field edits still go through the properties rail. */
  onInlineAiImprove?: (blockId: string, block: Block) => void;
  onInlineAiRewrite?: (blockId: string, block: Block) => void;
  onInlineAiExpand?: (blockId: string, block: Block) => void;
  inlineAiBusy?: "improve" | "rewrite" | "expand" | null;
  onInsertAiBlockClick?: () => void;
};

export function BlockInspectorShell({
  blocks,
  selectedBlockId,
  setSelectedBlockId,
  blocksValidation,
  onMoveBlock,
  onDeleteBlock,
  setEditOpen,
  setEditIndex,
  blockTypeSubtitle,
  onAddBlockClick,
  isForsidePage,
  onFillForsideFromRepo,
  aiBusyToolId,
  aiDisabled,
  onOpenCtaAi,
  onInlineAiImprove,
  onInlineAiRewrite,
  onInlineAiExpand,
  inlineAiBusy = null,
  onInsertAiBlockClick,
}: BlockInspectorShellProps) {
  const etRuntime = useElementTypeRuntimeMergedOptional();
  const elementRuntimeMerged = etRuntime?.data?.merged ?? null;

  return (
    <div className="space-y-2" data-lp-block-inspector-shell="navigator-only">
      {blocks.length === 0 ? (
        <>
          {isForsidePage && onFillForsideFromRepo ? (
            <Card variant="outline" className="rounded-xl p-4">
              <p className="text-sm font-medium text-[rgb(var(--lp-text))]">
                Denne siden tilsvarer forsiden. Ett klikk fyller ut hero full, verdikort, steg (zigzag), priser, tillitsrutenett, avsluttende CTA og relaterte sider.
              </p>
              <button
                type="button"
                onClick={() => void onFillForsideFromRepo?.()}
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
            <h3 className="text-sm font-medium text-[rgb(var(--lp-text))]">Start med en seksjon</h3>
            <p className="mt-1 max-w-[280px] text-xs text-[rgb(var(--lp-muted))]">
              Legg til en blokk — forhåndsvisning og struktur på arbeidsflaten; egenskaper i inspektoren til høyre.
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
            const open = selectedBlockId === block.id;
            return (
              <article
                key={block.id}
                id={`lp-editor-block-${block.id}`}
                className="border-b border-[rgb(var(--lp-border))] bg-white last:border-b-0"
                data-lp-element-type-alias={block.type}
              >
                <div className="lp-motion-row flex w-full items-center gap-2 px-2 py-2 hover:bg-[rgb(var(--lp-card))]/40">
                  <button
                    type="button"
                    onClick={() => setSelectedBlockId(block.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 border-0 bg-transparent p-0 text-left"
                  >
                    <span className="flex h-8 w-6 shrink-0 items-center justify-center text-[rgb(var(--lp-muted))]" aria-hidden title="Drag handle">
                      ++
                    </span>
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--lp-border))] bg-white/80 text-[rgb(var(--lp-muted))]">
                      <BlockTypeIcon type={block.type} />
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex shrink-0 items-center rounded-full border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                          Nr. {index + 1}
                        </span>
                        <span
                          className="truncate text-sm font-medium text-[rgb(var(--lp-text))]"
                          data-lp-element-type-title
                        >
                          {resolveElementRuntimeLabel(block.type, elementRuntimeMerged)}
                        </span>
                      </div>
                      <div className="text-[11px] font-medium leading-snug text-[rgb(var(--lp-muted))]">
                        {blockTypeSubtitle(block.type, block)}
                      </div>
                      {elementRuntimeMerged?.[block.type]?.editorHelpText ? (
                        <p className="text-[10px] leading-snug text-[rgb(var(--lp-text))]/80" data-lp-element-type-editor-help>
                          {elementRuntimeMerged[block.type]!.editorHelpText}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    {(block.type === "richText" ||
                      block.type === "hero" ||
                      block.type === "hero_bleed" ||
                      block.type === "cta") &&
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
                      title={
                        block.type === "banner" ?
                          "Rediger blokk (forhåndsvisning og skjemafelter)"
                        : "Rediger blokk (åpner felter eller JSON)"
                      }
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
                  <button
                    type="button"
                    onClick={() => setSelectedBlockId((prev) => (prev === block.id ? null : block.id))}
                    className="shrink-0 text-xs text-[rgb(var(--lp-muted))]"
                    aria-label={open ? "Skjul blokkdetaljer" : "Vis blokkdetaljer"}
                  >
                    {open ? "▼" : "▶"}
                  </button>
                </div>
                {blocksValidation.byId[block.id]?.length ? (
                  <ul className="pl-10 pr-3 pb-1 text-[11px] text-red-700">
                    {blocksValidation.byId[block.id].map((msg, i) => (
                      <li key={i}>• {msg}</li>
                    ))}
                  </ul>
                ) : null}

                {open ? (
                  <div
                    className="border-t border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))]/30 px-3 py-2"
                    data-lp-block-inspector-navigator-hint
                  >
                    <p className="text-center text-[11px] font-medium leading-snug text-[rgb(var(--lp-muted))]">
                      Innhold, innstillinger og struktur for «
                      {resolveElementRuntimeLabel(block.type, elementRuntimeMerged)}» redigeres i{" "}
                      <span className="text-[rgb(var(--lp-text))]">egenskapseditoren</span> (høyre panel → Innhold /
                      Design). Her er kun navigasjon og rekkefølge.
                    </p>
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
