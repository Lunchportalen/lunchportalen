"use client";

import { BlockDragHandle, BlockToolbar } from "@/components/cms";
import { BlockTypeIcon } from "@/app/(backoffice)/backoffice/content/_components/BlockTypeIcon";
import { getBlockLabel, getBlockShortLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";

import type { EditorBlockCanvasFrameProps } from "./editorBlockCanvasFrameProps";

/**
 * U80C: Hero = landing-modul — én stor flate, ingen chrome-rad / venstre handle-stripe.
 * Dra + verktøy som overlay-lag; identitet i bunngradient (ikke liste-rad).
 */
export function HeroCanvasFrame({
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
      data-lp-canvas-frame="hero"
      data-lp-canvas-geometry="hero-landing-slab"
      className={`relative min-h-[240px] overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-200/35 via-white to-slate-100/80 ${
        calm
          ? "shadow-[0_12px_40px_rgba(49,46,129,0.08)] ring-1 ring-indigo-200/30"
          : "shadow-[0_24px_64px_rgba(49,46,129,0.14)] ring-1 ring-indigo-300/35"
      }`}
    >
      {canReorderBlocks && dragHandleProps ? (
        <div
          className="absolute bottom-5 left-5 z-30 rounded-2xl border border-white/70 bg-white/92 p-2 shadow-lg shadow-indigo-900/10 backdrop-blur-sm"
          data-lp-canvas-hero-drag
        >
          <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible />
        </div>
      ) : null}

      <div
        className="absolute right-2 top-2 z-30 rounded-full border border-indigo-200/60 bg-white/92 px-1.5 py-1 shadow-md backdrop-blur-sm"
        data-lp-canvas-hero-tools
      >
        {tb}
      </div>

      {open && !calm ? (
        <div
          className="absolute left-4 top-4 z-30 max-w-[min(92%,20rem)] rounded-2xl border border-indigo-200/55 bg-white/95 px-3 py-2.5 text-left shadow-md backdrop-blur-sm"
          data-lp-canvas-hero-open-badge
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-800/70">Valgt blokk</p>
          <p className="mt-1 text-xs font-semibold text-[rgb(var(--lp-text))]">{getBlockLabel(block.type)}</p>
          {subtitleWhenOpen ? (
            <p className="mt-1.5 text-[10px] leading-snug text-[rgb(var(--lp-muted))]">{subtitleWhenOpen}</p>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onActivateCollapsed}
        className="relative z-10 flex min-h-[240px] w-full flex-col border-0 bg-transparent p-0 text-left outline-none transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500/35"
        data-lp-canvas-frame-body="hero"
      >
        <div className="flex min-h-[200px] flex-1 flex-col px-4 pb-28 pt-16">{collapsedBody}</div>
      </button>

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-32 bg-gradient-to-t from-indigo-950/55 via-indigo-950/20 to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute bottom-4 left-1/2 z-[8] flex max-w-[min(100%,22rem)] -translate-x-1/2 items-center gap-2 rounded-full border border-white/25 bg-white/20 px-4 py-2 shadow-inner backdrop-blur-md"
        aria-hidden
        data-lp-canvas-hero-identity
      >
        <BlockTypeIcon type={block.type} />
        <div className="min-w-0 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/90">{getBlockShortLabel(block.type)}</p>
          <p className="truncate text-xs font-semibold text-white">#{index + 1}</p>
        </div>
      </div>
    </div>
  );
}
