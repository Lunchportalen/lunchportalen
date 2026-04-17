"use client";

import { BlockDragHandle, BlockToolbar } from "@/components/cms";
import { BlockTypeIcon } from "@/app/(backoffice)/backoffice/content/_components/BlockTypeIcon";
import { getBlockLabel, getBlockShortLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";

import type { EditorBlockCanvasFrameProps } from "./editorBlockCanvasFrameProps";

/**
 * U80C: Related = kurert liste — venstre kant + divide-y som dominerende form, ikke generisk kort.
 */
export function RelatedCanvasFrame({
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
      data-lp-canvas-frame="related"
      data-lp-canvas-geometry="related-list-stack"
      className={`min-h-[152px] overflow-hidden rounded-lg border bg-white shadow-sm ${
        calm
          ? "border-slate-200/70 border-l-[3px] border-l-slate-400/80"
          : "border-indigo-200/50 border-l-[6px] border-l-indigo-600"
      }`}
    >
      <div className={`divide-y ${calm ? "divide-slate-100" : "divide-indigo-100"}`}>
        <div
          className={`flex items-center justify-between gap-2 px-3 py-2.5 ${calm ? "bg-slate-50/50" : "bg-indigo-50/40"}`}
          data-lp-canvas-related-list-head
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            {canReorderBlocks && dragHandleProps ? (
              <div
                className={`shrink-0 rounded-md border bg-white px-1 py-0.5 ${calm ? "border-slate-200/80 shadow-none" : "border-indigo-200/70 shadow-sm"}`}
                data-lp-canvas-related-drag
              >
                <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible />
              </div>
            ) : (
              <span className="h-8 w-8 shrink-0" aria-hidden />
            )}
            <BlockTypeIcon type={block.type} />
            <div className="min-w-0">
              {!calm ? (
                <p className="text-[10px] font-bold uppercase tracking-wide text-indigo-900/60">Kuratert liste</p>
              ) : null}
              <p className="truncate text-sm font-semibold text-[rgb(var(--lp-text))]">{getBlockLabel(block.type)}</p>
            </div>
          </div>
          <div className="shrink-0">{tb}</div>
        </div>

        {!calm ? (
          <div className="flex items-center justify-between gap-2 px-3 py-2 text-[10px] text-[rgb(var(--lp-muted))]">
            <span className="font-medium tabular-nums">Lenker · #{index + 1}</span>
            <span className="font-semibold uppercase tracking-wide text-indigo-800/45">{getBlockShortLabel(block.type)}</span>
          </div>
        ) : null}

        {!open ? (
          <button
            type="button"
            onClick={onActivateCollapsed}
            className="flex w-full border-0 bg-transparent p-0 text-left outline-none transition-colors hover:bg-indigo-50/30 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500/25"
            data-lp-canvas-frame-body="related"
          >
            <div className="w-full min-h-[76px] px-3 py-2.5">{collapsedBody}</div>
          </button>
        ) : (
          <div className="px-3 py-2.5">
            {subtitleWhenOpen ? (
              <p className="text-[10px] leading-snug text-[rgb(var(--lp-muted))]">{subtitleWhenOpen}</p>
            ) : calm ? null : (
              <p className="text-[10px] text-[rgb(var(--lp-muted))]">Valgt · rediger i egenskapseditor</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
