"use client";

import { BlockDragHandle, BlockToolbar } from "@/components/cms";
import { BlockTypeIcon } from "@/app/(backoffice)/backoffice/content/_components/BlockTypeIcon";
import { getBlockLabel, getBlockShortLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";

import type { EditorBlockCanvasFrameProps } from "./editorBlockCanvasFrameProps";

function RailNode({ filled, n }: { filled?: boolean; n: string }) {
  return (
    <div className="flex flex-col items-center">
      <span
        className={`h-3 w-3 shrink-0 rounded-full border-2 ${filled ? "border-sky-600 bg-sky-500" : "border-sky-300 bg-white"}`}
        aria-hidden
      />
      <span className="mt-1 text-[9px] font-semibold tabular-nums text-sky-900/70">{n}</span>
    </div>
  );
}

/**
 * U80D: Steps = horisontal prosessflyt — rygg er en linje gjennom noder (ikke venstre handle-stripe).
 * Dra-chip i første node; verktøy i seksjonshode.
 */
export function StepsCanvasFrame({
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
      data-lp-canvas-frame="steps"
      data-lp-canvas-geometry="steps-flow-rail"
      className={`relative flex min-h-[176px] flex-col overflow-hidden rounded-2xl bg-sky-50/45 ${
        calm
          ? "shadow-[0_8px_28px_rgba(14,116,144,0.05)] ring-1 ring-sky-200/40"
          : "shadow-[0_18px_46px_rgba(14,116,144,0.09)] ring-1 ring-sky-300/45"
      }`}
    >
      <div className="flex flex-row items-start justify-between gap-2 border-b border-sky-200/55 bg-white/65 px-3 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-row items-center gap-2">
            <BlockTypeIcon type={block.type} />
            {!calm ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-800/65">Prosess</span>
            ) : null}
          </div>
          <h3 className="mt-1 text-base font-bold leading-tight text-sky-950">{getBlockLabel(block.type)}</h3>
          <p className="mt-0.5 text-[10px] font-medium tabular-nums text-[rgb(var(--lp-muted))]">
            {getBlockShortLabel(block.type)} · #{index + 1}
          </p>
          {open && subtitleWhenOpen ? (
            <p className="mt-2 text-[10px] leading-snug text-[rgb(var(--lp-muted))]">{subtitleWhenOpen}</p>
          ) : null}
        </div>
        <div className="shrink-0 pt-0.5" data-lp-canvas-steps-tools>
          {tb}
        </div>
      </div>

      <div className="relative px-5 pb-1 pt-4" data-lp-canvas-steps-rail>
        <div
          className="pointer-events-none absolute left-12 right-12 top-[1.85rem] h-[3px] rounded-full bg-gradient-to-r from-sky-200 via-sky-400/90 to-sky-200"
          aria-hidden
        />
        <div className="relative flex flex-row items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col items-center">
            {canReorderBlocks && dragHandleProps ? (
              <div
                className="mb-1 rounded-lg border border-sky-300/70 bg-white/95 px-1 py-0.5 shadow-sm"
                data-lp-canvas-steps-drag
              >
                <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible />
              </div>
            ) : (
              <div className="mb-1 h-8" aria-hidden />
            )}
            <RailNode filled n="1" />
          </div>
          <div className="flex flex-1 justify-center pt-7">
            <RailNode n="2" />
          </div>
          <div className="flex flex-1 justify-end pt-7">
            <RailNode n="3" />
          </div>
        </div>
      </div>

      {!open ? (
        <button
          type="button"
          onClick={onActivateCollapsed}
          className="w-full flex-1 border-0 bg-transparent p-0 text-left outline-none transition-colors hover:bg-sky-50/40 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500/25"
          data-lp-canvas-frame-body="steps"
        >
          <div className="mx-3 mb-3 min-h-[88px] rounded-lg border border-dashed border-sky-200/85 bg-sky-50/35 px-2 py-2">
            {collapsedBody}
          </div>
        </button>
      ) : (
        <div className="min-h-[64px] border-t border-sky-100/70 px-3 py-2 text-center text-[10px] text-[rgb(var(--lp-muted))]">
          Forhåndsvisning i egenskapseditoren
        </div>
      )}
    </div>
  );
}
