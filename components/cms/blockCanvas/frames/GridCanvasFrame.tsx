"use client";

import { BlockDragHandle, BlockToolbar } from "@/components/cms";
import { BlockTypeIcon } from "@/app/(backoffice)/backoffice/content/_components/BlockTypeIcon";
import { getBlockLabel, getBlockShortLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";

import type { EditorBlockCanvasFrameProps } from "./editorBlockCanvasFrameProps";

/**
 * U80C: Grid = rutenett som ytre lesning — synlige celler i hele flaten; verktøy/dra i hjørneceller.
 */
export function GridCanvasFrame({
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
      data-lp-canvas-frame="grid"
      data-lp-canvas-geometry="grid-lattice-surface"
      className={`relative min-h-[188px] overflow-hidden rounded-lg bg-slate-100/90 shadow-inner ${
        calm ? "ring-1 ring-slate-300/45" : "ring-2 ring-slate-400/35"
      }`}
      style={{
        backgroundImage: `
          linear-gradient(to right, rgb(148 163 184 / 0.35) 1px, transparent 1px),
          linear-gradient(to bottom, rgb(148 163 184 / 0.35) 1px, transparent 1px)
        `,
        backgroundSize: "28px 28px",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-slate-200/30" aria-hidden />

      <div className="absolute left-2 top-2 z-20 rounded-md border border-slate-300/80 bg-white/95 p-1 shadow-md backdrop-blur-sm" data-lp-canvas-grid-drag>
        {canReorderBlocks && dragHandleProps ? (
          <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible />
        ) : (
          <span className="inline-flex h-8 w-8 items-center justify-center text-[9px] font-bold text-slate-400">·</span>
        )}
      </div>

      <div className="absolute right-2 top-2 z-20 rounded-md border border-slate-300/80 bg-white/95 p-0.5 shadow-md backdrop-blur-sm" data-lp-canvas-grid-tools>
        {tb}
      </div>

      <div
        className="relative z-10 mx-3 mt-12 grid min-h-[40px] grid-cols-4 gap-1.5 opacity-95"
        aria-hidden
      >
        {[0, 1, 2, 3].map((cell) => (
          <div
            key={cell}
            className="min-h-[36px] rounded border border-slate-400/45 bg-white/55 shadow-inner"
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center px-6 pb-3 pt-3 text-center">
        <div className="flex items-center justify-center gap-2 rounded-lg border border-slate-300/60 bg-white/90 px-3 py-2 shadow-sm">
          <BlockTypeIcon type={block.type} />
          <div className="text-left">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">{getBlockShortLabel(block.type)}</div>
            <div className="text-xs font-semibold text-[rgb(var(--lp-text))]">{getBlockLabel(block.type)}</div>
          </div>
        </div>
        <span className="mt-1 text-[10px] font-medium tabular-nums text-[rgb(var(--lp-muted))]">Rutenett · #{index + 1}</span>
        {open && subtitleWhenOpen ? (
          <p className="mt-2 max-w-sm text-[9px] leading-snug text-[rgb(var(--lp-muted))]">{subtitleWhenOpen}</p>
        ) : null}
      </div>

      {!open ? (
        <button
          type="button"
          onClick={onActivateCollapsed}
          className="relative z-10 mx-3 mb-3 mt-1 w-[calc(100%-1.5rem)] border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500/35"
          data-lp-canvas-frame-body="grid"
        >
          <div className="min-h-[96px] rounded-md border-2 border-dashed border-slate-400/55 bg-white/85 px-2 py-2 shadow-sm">{collapsedBody}</div>
        </button>
      ) : calm ? null : (
        <div className="relative z-10 mx-3 mb-3 rounded-md border border-dashed border-slate-400/50 bg-white/70 px-2 py-2 text-center text-[10px] text-[rgb(var(--lp-muted))]">
          Rutenett valgt · forhåndsvisning i panelet under
        </div>
      )}
    </div>
  );
}
