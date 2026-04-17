"use client";

import { BlockDragHandle, BlockToolbar } from "@/components/cms";
import { BlockTypeIcon } from "@/app/(backoffice)/backoffice/content/_components/BlockTypeIcon";
import { getBlockLabel, getBlockShortLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";

import type { EditorBlockCanvasFrameProps } from "./editorBlockCanvasFrameProps";

/**
 * U80C: Pricing = tier-landskap — tre søyler som ytre kropp; featured midt søyle løfter hele formen.
 * Dra i venstre søyle-topp, verktøy flytende over høyre tier.
 */
export function PricingCanvasFrame({
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
      data-lp-canvas-frame="pricing"
      data-lp-canvas-geometry="pricing-tier-columns"
      className={`relative min-h-[212px] overflow-hidden rounded-2xl bg-slate-200/35 ${
        calm
          ? "shadow-[0_10px_36px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/55"
          : "shadow-[0_22px_60px_rgba(15,23,42,0.1)] ring-1 ring-slate-300/50"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-slate-100/80 via-slate-200/25 to-slate-300/35"
        aria-hidden
        data-lp-canvas-pricing-tier-backdrop
      />
      <div className="absolute right-3 top-3 z-20 rounded-lg border border-white/80 bg-white/95 p-0.5 shadow-md backdrop-blur-sm" data-lp-canvas-pricing-tools>
        {tb}
      </div>

      <div className="relative z-10 grid grid-cols-3 gap-2 px-2 pb-2 pt-10" data-lp-canvas-pricing-tiers>
        <div className="flex flex-col items-center rounded-t-xl bg-slate-300/50 pb-3 pt-4 text-center">
          <div className="flex min-h-[2.5rem] items-start justify-center">
            {canReorderBlocks && dragHandleProps ? (
              <div className="rounded-lg border border-slate-400/40 bg-white/90 p-1 shadow-sm" data-lp-canvas-pricing-drag>
                <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible />
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onActivateCollapsed}
            className="mt-2 border-0 bg-transparent p-0 text-[9px] font-bold uppercase tracking-wide text-slate-600 outline-none hover:text-slate-800 focus-visible:underline"
          >
            Start
          </button>
        </div>

        <button
          type="button"
          onClick={onActivateCollapsed}
          className="-mt-6 flex flex-col items-center rounded-t-2xl bg-gradient-to-b from-amber-400 via-amber-200 to-amber-50 px-2 pb-4 pt-7 text-center shadow-xl shadow-amber-900/15 ring-2 ring-amber-500/45 outline-none transition-transform hover:scale-[1.01] focus-visible:ring-2 focus-visible:ring-pink-500/40"
          data-lp-canvas-pricing-featured
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-600/30 bg-white/95 shadow-inner">
            <BlockTypeIcon type={block.type} />
          </div>
          <span className="mt-2 text-[10px] font-bold uppercase tracking-wide text-amber-950/90">{getBlockShortLabel(block.type)}</span>
          <span className="mt-0.5 text-xs font-semibold text-amber-950">{getBlockLabel(block.type)}</span>
          <span className="mt-1 text-[10px] font-medium tabular-nums text-amber-900/70">#{index + 1}</span>
          {open && subtitleWhenOpen ? (
            <p className="mt-2 max-w-[11rem] text-[9px] leading-snug text-amber-950/80">{subtitleWhenOpen}</p>
          ) : null}
        </button>

        <div className="flex flex-col items-center rounded-t-xl bg-slate-300/50 pb-3 pt-4 text-center">
          <button
            type="button"
            onClick={onActivateCollapsed}
            className="mt-8 border-0 bg-transparent p-0 text-[9px] font-bold uppercase tracking-wide text-slate-600 outline-none hover:text-slate-800 focus-visible:underline"
          >
            Enterprise
          </button>
        </div>
      </div>

      {!open ? (
        <div className="relative z-10 border-t border-slate-300/40 bg-white/60 px-2 py-2">
          <div className="min-h-[72px] rounded-lg border border-slate-200/80 bg-white/90 px-2 py-2 shadow-inner" data-lp-canvas-frame-body="pricing">
            {collapsedBody}
          </div>
        </div>
      ) : null}
    </div>
  );
}
