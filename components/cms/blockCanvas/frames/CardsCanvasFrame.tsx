"use client";

import { BlockDragHandle, BlockToolbar } from "@/components/cms";
import { BlockTypeIcon } from "@/app/(backoffice)/backoffice/content/_components/BlockTypeIcon";
import { getBlockLabel, getBlockShortLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";

import type { EditorBlockCanvasFrameProps } from "./editorBlockCanvasFrameProps";

/**
 * U80C: Cards = én seksjonsflate — intro + kort-preview i samme kropp, ingen venstre handle-kolonne.
 */
export function CardsCanvasFrame({
  block,
  index,
  open,
  canReorderBlocks,
  dragHandleProps,
  collapsedBody,
  onActivateCollapsed,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onEdit,
  onDelete,
  disabledMoveUp,
  disabledMoveDown,
  subtitleWhenOpen,
  calmDetailBlockChrome,
}: EditorBlockCanvasFrameProps) {
  const calm = Boolean(calmDetailBlockChrome);
  const tb = (
    <BlockToolbar
      ariaLabel={`Verktøy for blokk ${index + 1}`}
      attach="inline"
      disabledMoveUp={disabledMoveUp}
      disabledMoveDown={disabledMoveDown}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onDuplicate={onDuplicate}
      onEdit={onEdit}
      onDelete={onDelete}
      revealOnGroupHover={!open}
    />
  );

  return (
    <div
      data-lp-canvas-frame="cards"
      data-lp-canvas-geometry="cards-section-slab"
      className={`min-h-[164px] overflow-hidden rounded-2xl ${
        calm
          ? "bg-gradient-to-b from-slate-50/90 via-white to-white shadow-[0_8px_28px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/65"
          : "bg-gradient-to-b from-amber-100/45 via-amber-50/25 to-white shadow-[0_20px_56px_rgba(146,64,14,0.09)] ring-2 ring-amber-200/50"
      }`}
    >
      <div
        className={`border-b px-4 py-3 ${calm ? "border-slate-200/60 bg-white/95" : "border-amber-200/50 bg-amber-50/40"}`}
      >
        <div className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            {canReorderBlocks && dragHandleProps ? (
              <div
                className={`inline-flex w-fit items-center gap-2 rounded-xl border px-2.5 py-1.5 ${
                  calm
                    ? "border-slate-200/70 bg-white shadow-none"
                    : "border-amber-300/60 bg-white/95 shadow-sm"
                }`}
                data-lp-canvas-cards-drag-chip
              >
                <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible />
                {!calm ? (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-900/55">Flytt seksjon</span>
                ) : null}
              </div>
            ) : null}
            <div className="min-w-0">
              {!calm ? (
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-900/45">Seksjonsflate</p>
              ) : null}
              <div className={`flex flex-wrap items-center gap-2 ${calm ? "" : "mt-1"}`}>
                <BlockTypeIcon type={block.type} />
                <span className="text-sm font-semibold text-[rgb(var(--lp-text))]">{getBlockLabel(block.type)}</span>
                <span className="text-[10px] font-medium tabular-nums text-[rgb(var(--lp-muted))]">#{index + 1}</span>
              </div>
              {!calm ? (
                <p className="mt-1 text-[10px] leading-snug text-amber-900/50">{getBlockShortLabel(block.type)}</p>
              ) : null}
            </div>
          </div>
          <div
            className={`shrink-0 rounded-lg border p-0.5 ${calm ? "border-slate-200/70 bg-white shadow-none" : "border-amber-200/60 bg-white/80 shadow-sm"}`}
            data-lp-canvas-cards-tools
          >
            {tb}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onActivateCollapsed}
        className={`w-full border-0 bg-transparent p-0 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500/30 ${
          calm ? "hover:bg-slate-50/40" : "hover:bg-amber-50/15"
        }`}
        data-lp-canvas-frame-body="cards"
      >
        <div
          className={`mx-3 mb-4 mt-4 rounded-xl border p-3 shadow-inner min-h-[104px] ${
            calm ? "border-slate-200/65 bg-white" : "border-amber-100/70 bg-white/75"
          }`}
        >
          {!calm ? (
            <div className="mb-2 grid grid-cols-3 gap-2" aria-hidden>
              <span className="h-2 rounded-md bg-amber-200/45 shadow-inner" />
              <span className="h-2 rounded-md bg-amber-200/45 shadow-inner" />
              <span className="h-2 rounded-md bg-amber-200/45 shadow-inner" />
            </div>
          ) : null}
          <div className="min-h-[72px]">{collapsedBody}</div>
        </div>
        {open ? (
          <div className={`px-4 py-2 ${calm ? "border-t border-slate-200/55" : "border-t border-amber-100/60"}`}>
            {subtitleWhenOpen ? (
              <p className="text-[10px] leading-snug text-[rgb(var(--lp-muted))]">{subtitleWhenOpen}</p>
            ) : calm ? null : (
              <p className="text-[10px] font-semibold text-pink-700">Valgt · rediger i egenskapseditor</p>
            )}
          </div>
        ) : null}
      </button>
    </div>
  );
}
