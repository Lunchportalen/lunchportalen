"use client";

import { BlockDragHandle, BlockToolbar } from "@/components/cms";
import { BlockTypeIcon } from "@/app/(backoffice)/backoffice/content/_components/BlockTypeIcon";
import { getBlockLabel, getBlockShortLabel } from "@/app/(backoffice)/backoffice/content/_components/blockLabels";
import type { EditorBlockCanvasFrameProps } from "./editorBlockCanvasFrameProps";
import { BlockChromeRow } from "./BlockChromeRow";

export type DefaultCanvasFrameProps = EditorBlockCanvasFrameProps & {
  /** Visuelt adskilt fra marketing-rammer — standard rad-chrome eies her, ikke i WorkspaceBody. */
  surface?: "richText" | "image" | "divider" | "form" | "banner" | "other";
};

const SURFACE_RING: Record<NonNullable<DefaultCanvasFrameProps["surface"]>, string> = {
  richText: "ring-violet-200/55 from-violet-50/35 via-white to-white",
  image: "ring-sky-200/55 from-sky-50/35 via-white to-white",
  divider: "ring-slate-200/70 from-slate-100/40 via-white to-white",
  form: "ring-emerald-200/50 from-emerald-50/30 via-white to-white",
  banner: "ring-rose-200/50 from-rose-50/30 via-white to-white",
  other: "ring-slate-200/60 from-slate-50/30 via-white to-white",
};

/**
 * U80B: Standardblokker beholder klassisk chrome-rad — bygget her, ikke delt med nøkkelblokkene via WorkspaceBody.
 */
export function DefaultCanvasFrame({
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
  surface = "other",
}: DefaultCanvasFrameProps) {
  const calm = Boolean(calmDetailBlockChrome);
  const ring = calm
    ? ""
    : SURFACE_RING[surface] ?? SURFACE_RING.other;

  return (
    <div
      data-lp-canvas-frame="default"
      data-lp-canvas-surface={surface}
      data-lp-canvas-geometry="default-chrome-row"
      data-lp-canvas-detail-property-field={calm ? "true" : undefined}
      className={
        calm
          ? "group/detail-field-entry flex min-h-0 flex-col overflow-hidden rounded border border-slate-200/55 bg-white"
          : `flex min-h-[128px] flex-col overflow-hidden rounded-b-md bg-gradient-to-b shadow-[0_10px_36px_rgba(15,23,42,0.05)] ring-1 ${ring}`
      }
    >
      <BlockChromeRow variant="editorial" className={calm ? "!min-h-[28px] !border-b-slate-200/50 !bg-slate-50/40" : ""}>
        <>
          <div
            className={
              calm
                ? "flex w-6 shrink-0 flex-col items-center justify-center border-r border-slate-200/45 py-1 opacity-40 hover:opacity-100"
                : "flex w-9 shrink-0 flex-col items-center border-r border-slate-200/70 pt-1.5"
            }
          >
            {canReorderBlocks && dragHandleProps ? (
              <BlockDragHandle dragHandleProps={dragHandleProps} embedded alwaysVisible />
            ) : (
              <span className={calm ? "h-5 w-5 shrink-0" : "h-8 w-8 shrink-0"} aria-hidden />
            )}
          </div>

          <button
            type="button"
            onClick={onActivateCollapsed}
            className={`flex min-w-0 flex-1 items-start gap-2 border-0 bg-transparent text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500/30 ${
              calm ? "py-1 pl-1.5 pr-1 hover:bg-white/90" : "py-1.5 pl-2 pr-2 hover:bg-white/80"
            }`}
          >
            <div
              className={`flex shrink-0 items-center justify-center rounded border bg-white ${
                calm
                  ? "h-6 w-6 border-slate-200/60 shadow-none"
                  : "h-8 w-8 rounded-md border-slate-200/90 shadow-[0_1px_0_rgba(15,23,42,0.04)]"
              }`}
            >
              <BlockTypeIcon type={block.type} />
            </div>
            <div className="min-w-0 flex-1 text-left">
              {calm ? (
                <>
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <span className="truncate text-[13px] font-medium leading-tight text-slate-800">
                          {getBlockLabel(block.type)}
                        </span>
                        <span className="sr-only">
                          Rekkefølge {index + 1}
                        </span>
                      </div>
                      {open && subtitleWhenOpen ? (
                        <p className="mt-1 text-[10px] leading-snug text-[rgb(var(--lp-muted))]">{subtitleWhenOpen}</p>
                      ) : null}
                    </div>
                    <span
                      className={`shrink-0 text-[10px] tabular-nums text-slate-300 ${open ? "text-slate-400" : ""}`}
                      aria-hidden
                    >
                      {open ? <span className="sr-only">Åpen</span> : "▶"}
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {getBlockShortLabel(block.type)}
                    </span>
                    <span className="text-[10px] font-medium tabular-nums text-[rgb(var(--lp-muted))]">· #{index + 1}</span>
                  </div>
                  <div className="mt-0.5 flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold leading-tight text-[rgb(var(--lp-text))]">
                      {getBlockLabel(block.type)}
                    </span>
                    <span
                      className={`ml-auto shrink-0 text-[10px] text-[rgb(var(--lp-muted))] ${open ? "font-semibold text-pink-700" : ""}`}
                      aria-hidden
                    >
                      {open ? "Valgt" : "▶"}
                    </span>
                  </div>
                  {open && subtitleWhenOpen ? (
                    <p className="mt-1 text-[10px] leading-snug text-[rgb(var(--lp-muted))]">{subtitleWhenOpen}</p>
                  ) : null}
                </>
              )}
            </div>
          </button>

          <div
            className={
              calm
                ? "flex shrink-0 items-start border-l border-slate-200/45 bg-transparent py-0.5 pl-0.5 pr-0.5"
                : "flex shrink-0 items-start border-l border-slate-200/70 bg-white/60 py-1 pl-1 pr-1"
            }
          >
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
              revealOnGroupHover={calm ? true : !open}
              editorEntryChrome={calm ? true : false}
              fieldListMode={calm ? true : false}
              fieldListToolsIconOnly={calm ? true : false}
            />
          </div>
        </>
      </BlockChromeRow>
      {!open ? (
        <button
          type="button"
          onClick={onActivateCollapsed}
          className="w-full border-0 bg-transparent p-0 text-left outline-none transition-colors hover:bg-white/50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-pink-500/25"
          data-lp-canvas-frame-scan="default"
        >
          <div className={calm ? "min-h-[36px] px-2.5 pb-1.5 pt-1.5" : "min-h-[92px] px-2 pb-2.5 pt-2"}>{collapsedBody}</div>
        </button>
      ) : null}
    </div>
  );
}
