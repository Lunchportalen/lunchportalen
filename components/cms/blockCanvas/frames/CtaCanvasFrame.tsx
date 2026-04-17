"use client";

import { BlockDragHandle, BlockToolbar } from "@/components/cms";
import { BlockTypeIcon } from "@/app/(backoffice)/backoffice/content/_components/BlockTypeIcon";
import { getBlockLabel, getBlockShortLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";

import type { EditorBlockCanvasFrameProps } from "./editorBlockCanvasFrameProps";

/**
 * U80C: CTA = handlingsmodul — primærflate dominerer; meta/dra i mørk bunnstripe (ikke samme rad som editor-chrome).
 */
export function CtaCanvasFrame({
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
      data-lp-canvas-frame="cta"
      data-lp-canvas-geometry="cta-action-slab"
      className={`min-h-[198px] overflow-hidden rounded-2xl bg-gradient-to-br from-pink-500/12 via-white to-rose-50/40 ${
        calm
          ? "shadow-[0_10px_32px_rgba(190,24,93,0.06)] ring-1 ring-pink-200/35"
          : "shadow-[0_22px_50px_rgba(190,24,93,0.12)] ring-2 ring-pink-300/40"
      }`}
    >
      {!open ? (
        <>
          <div className="px-4 pb-2 pt-5">
            <button
              type="button"
              onClick={onActivateCollapsed}
              className="w-full rounded-2xl border border-pink-500/20 bg-gradient-to-b from-pink-600 to-rose-700 px-5 py-4 text-center text-sm font-semibold text-white shadow-lg shadow-pink-900/20 outline-none transition-transform hover:scale-[1.008] focus-visible:ring-2 focus-visible:ring-pink-400/50 active:scale-[0.995]"
              data-lp-canvas-cta-primary-stub
            >
              Primær handling (redigeres i egenskapseditor)
            </button>
            <p className="mt-3 text-center text-[10px] font-medium text-[rgb(var(--lp-muted))]">
              Forhåndsvisning under · sekundær kontroll i bunnfelt
            </p>
          </div>
          <button
            type="button"
            onClick={onActivateCollapsed}
            className="w-full border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500/35"
            data-lp-canvas-frame-body="cta"
          >
            <div className="max-h-[5rem] min-h-[80px] overflow-hidden px-4 pb-2">{collapsedBody}</div>
          </button>
          <div
            className="flex items-center justify-between gap-3 bg-gradient-to-r from-pink-950 via-rose-900 to-pink-950 px-3 py-2.5 text-white"
            data-lp-canvas-cta-meta-bar
          >
            <div className="flex min-w-0 items-center gap-2">
              {canReorderBlocks && dragHandleProps ? (
                <div className="rounded-lg border border-white/20 bg-white/10 p-1" data-lp-canvas-cta-drag>
                  <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible />
                </div>
              ) : (
                <span className="h-8 w-8 shrink-0" aria-hidden />
              )}
              <BlockTypeIcon type={block.type} />
              <div className="min-w-0">
                <p className="truncate text-[11px] font-semibold">{getBlockShortLabel(block.type)}</p>
                <p className="truncate text-[10px] text-white/75">#{index + 1}</p>
              </div>
            </div>
            <div className="shrink-0 rounded-lg border border-white/25 bg-white/95 p-0.5 shadow-sm">{tb}</div>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-4">
          <div className="rounded-2xl border border-pink-200/60 bg-white/90 p-3 shadow-inner">
            {!calm ? (
              <p className="text-[10px] font-bold uppercase tracking-wider text-pink-800/70">Valgt CTA</p>
            ) : null}
            <p className={`text-sm font-semibold text-[rgb(var(--lp-text))] ${calm ? "" : "mt-1"}`}>
              {getBlockLabel(block.type)}
            </p>
            {subtitleWhenOpen ? (
              <p className="mt-2 text-[10px] leading-snug text-[rgb(var(--lp-muted))]">{subtitleWhenOpen}</p>
            ) : null}
          </div>
          <div className="flex items-center justify-between gap-2 rounded-xl bg-pink-950 px-3 py-2 text-white">
            <div className="flex items-center gap-2">
              {canReorderBlocks && dragHandleProps ? (
                <div className="rounded-lg border border-white/20 bg-white/10 p-1">
                  <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible />
                </div>
              ) : null}
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 bg-white/10">
                <BlockTypeIcon type={block.type} />
              </div>
            </div>
            <div className="shrink-0 rounded-lg border border-white/25 bg-white/95 p-0.5 shadow-sm">{tb}</div>
          </div>
        </div>
      )}
    </div>
  );
}
