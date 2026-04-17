"use client";

import { BlockDragHandle, BlockToolbar } from "@/components/cms";
import type { EditorBlockCanvasFrameProps } from "@/components/cms/blockCanvas/frames/editorBlockCanvasFrameProps";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import { getBlockDocumentLeadLines, getBlockDocumentSectionHeading, getBlockLabel, getBlockShortLabel } from "./blockLabels";
import { blockTypeSubtitle } from "./contentWorkspace.blocks";
import type { Block } from "./editorBlockTypes";

function previewDataForSummary(block: Block): Record<string, unknown> {
  const b = block as unknown as { contentData?: Record<string, unknown>; body?: unknown; heading?: unknown };
  if (b.contentData && typeof b.contentData === "object") return { ...b.contentData };
  const out: Record<string, unknown> = {};
  if (typeof b.body === "string") out.body = b.body;
  if (typeof b.heading === "string") out.heading = b.heading;
  return out;
}

function humanSummaryLine(block: Block): string {
  const def = getBlockTypeDefinition(block.type);
  let fromPreview = "";
  try {
    const raw = def?.previewSummaryBuilder?.(previewDataForSummary(block));
    fromPreview = typeof raw === "string" ? raw.trim() : "";
  } catch {
    fromPreview = "";
  }
  if (fromPreview.length > 0) {
    return fromPreview.length > 200 ? `${fromPreview.slice(0, 197)}…` : fromPreview;
  }
  const sub = blockTypeSubtitle(block.type, block).trim();
  if (sub.length > 0) return sub.length > 200 ? `${sub.slice(0, 197)}…` : sub;
  return "";
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Detail: blokk som dokumentseksjon — innhold og hierarki først, verktøy sekundære (ikon, hover).
 */
export function ContentDetailCompactBlockFrame({
  block,
  index,
  open,
  canReorderBlocks,
  dragHandleProps,
  onActivateCollapsed,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onEdit,
  onDelete,
  disabledMoveUp,
  disabledMoveDown,
  subtitleWhenOpen: _subtitleWhenOpen,
  calmDetailBlockChrome: _calmDetailBlockChrome,
  inlineEditor,
}: EditorBlockCanvasFrameProps) {
  const sectionHeading = getBlockDocumentSectionHeading(block);
  const leadLines = getBlockDocumentLeadLines(block);
  const summaryFallback = humanSummaryLine(block);
  const sectionEditing = Boolean(inlineEditor);
  const displayLines =
    sectionEditing
      ? []
      : leadLines.length > 0
        ? leadLines
        : summaryFallback
          ? [summaryFallback]
          : [];

  const typeFoot = getBlockLabel(block.type);
  const short = getBlockShortLabel(block.type).trim();
  const typeFootDetail = short && short !== typeFoot ? `${typeFoot} · ${short}` : typeFoot;

  const dragTrailing =
    canReorderBlocks && dragHandleProps ? (
      <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible chrome="detailQuiet" />
    ) : null;

  /** Subtil vertikal rytme: ikke «samme boks» gjentatt uten variasjon. */
  const rhythmGap = index > 0 ? (index % 2 === 0 ? "mt-6 sm:mt-7" : "mt-4 sm:mt-5") : "";
  const rhythmShape = index % 2 === 0 ? "rounded-xl" : "rounded-2xl";
  const passiveSurface =
    index % 2 === 0
      ? "border-slate-200/55 bg-white"
      : "border-slate-200/45 bg-[rgb(255,252,248)]/95";

  return (
    <section
      data-lp-canvas-frame="compact-detail"
      data-lp-content-detail-compact="true"
      data-lp-detail-block-document-section="true"
      data-lp-detail-section-editing={sectionEditing ? "true" : undefined}
      data-lp-detail-section-index={index}
      aria-labelledby={`lp-detail-block-h-${block.id}`}
      className={cn(
        "min-w-0 border px-4 py-5 sm:px-5 sm:py-6",
        rhythmShape,
        rhythmGap,
        sectionEditing
          ? "border-pink-200/50 bg-gradient-to-b from-pink-50/40 via-white to-amber-50/[0.07] shadow-[0_3px_24px_rgba(236,72,153,0.07)] ring-2 ring-pink-400/20"
          : `${passiveSurface} shadow-[0_1px_0_rgba(15,23,42,0.03)]`,
        open && !sectionEditing ? "ring-1 ring-slate-300/30" : "",
      )}
    >
      <div
        className={cn(
          "group/detail-field-entry flex min-w-0 items-start gap-3 sm:gap-4",
          sectionEditing ? "border-l-[4px] border-pink-500/45 pl-3 sm:border-l-[5px] sm:pl-5" : "",
        )}
      >
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onActivateCollapsed}
            aria-expanded={open ? "true" : "false"}
            aria-controls={`lp-detail-block-panel-${block.id}`}
            id={`lp-detail-block-h-${block.id}`}
            className={cn(
              "block w-full border-0 bg-transparent py-0 text-left outline-none",
              "rounded-md px-0 focus-visible:ring-2 focus-visible:ring-slate-300/40 focus-visible:ring-offset-2",
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3
                className={cn(
                  "leading-snug tracking-tight text-slate-900",
                  sectionEditing
                    ? "text-[1.35rem] font-semibold sm:text-[1.4rem]"
                    : index % 3 === 0
                      ? "text-lg font-semibold"
                      : "text-[1.05rem] font-semibold sm:text-lg",
                )}
              >
                {sectionHeading}
              </h3>
              {sectionEditing ? (
                <span className="rounded-full border border-pink-200/60 bg-white/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-pink-900/65">
                  Aktiv
                </span>
              ) : null}
            </div>
            {displayLines.length > 0 ? (
              <div className="mt-3 space-y-2">
                {displayLines.map((line, i) => (
                  <p
                    key={i}
                    className={cn(
                      "text-[15px] leading-relaxed text-slate-700",
                      i === 0 ? "font-normal" : "text-sm text-slate-600",
                    )}
                  >
                    {line}
                  </p>
                ))}
              </div>
            ) : !sectionEditing ? (
              <p className="mt-3 text-sm italic leading-relaxed text-slate-400">Tom seksjon — klikk for å fylle ut.</p>
            ) : (
              <p className="mt-3 text-[13px] leading-relaxed text-slate-500">
                Rediger innholdet i feltlisten under — det er en del av denne seksjonen.
              </p>
            )}
            <p
              className={cn(
                "mt-4 text-[11px] font-medium uppercase tracking-wide",
                sectionEditing ? "text-slate-400/90" : "text-slate-400",
              )}
            >
              {typeFootDetail}
            </p>
            <span className="sr-only">
              Seksjon {index + 1} av {sectionHeading}
            </span>
          </button>
        </div>

        <div
          className="flex shrink-0 flex-col items-end justify-start gap-1 self-start pt-0.5"
          data-lp-detail-block-actions-wrap
        >
          <BlockToolbar
            ariaLabel={`Verktøy for seksjon ${index + 1}`}
            attach="inline"
            disabledMoveUp={disabledMoveUp}
            disabledMoveDown={disabledMoveDown}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDuplicate={onDuplicate}
            onEdit={onEdit}
            onDelete={onDelete}
            revealOnGroupHover={!open}
            editorEntryChrome
            fieldListMode
            fieldListToolsIconOnly
            fieldListTrailing={dragTrailing}
          />
        </div>
      </div>

      {inlineEditor ? (
        <div
          id={`lp-detail-block-panel-${block.id}`}
          className="mt-6 border-t border-pink-100/70 pt-6 sm:mt-7 sm:pt-7"
          data-lp-detail-block-inline-editor="true"
        >
          {inlineEditor}
        </div>
      ) : null}
    </section>
  );
}
