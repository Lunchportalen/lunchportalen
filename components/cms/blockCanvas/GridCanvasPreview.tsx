"use client";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import type { GridItemRow } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import { truncate } from "./canvasPreviewUtils";

/** U91: flat projection = samme som editor. */
export function GridCanvasPreview({ block }: { block: Extract<Block, { type: "grid" }> }) {
  const flat = getBlockEntryFlatForRender(block);
  const items = (Array.isArray(flat.items) ? flat.items : []) as GridItemRow[];
  const cells = items.length;
  const withMedia = items.filter((it) => (it.imageId || "").trim() && (it.title || "").trim()).length;
  const withSub = items.filter((it) => (it.subtitle || "").trim()).length;
  const withMeta = items.filter((it) => (it.metaLine || "").trim()).length;
  const t = String(flat.title || "").trim();
  const introOk = String(flat.intro || "").trim().length > 0;
  const varLabel = String(flat.variant ?? "center").trim();

  const cols = cells <= 4 ? 2 : 3;
  const n = cells === 0 ? 6 : Math.min(cells, 6);

  return (
    <div
      className="min-w-0 rounded-xl border border-slate-400/35 bg-slate-100/50 p-3 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)]"
      data-lp-block-preview
      data-lp-block-preview-kind="grid"
      data-lp-canvas-view="grid"
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2 border-b border-slate-300/50 pb-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-600">Rutenett · lokasjoner</p>
          <p className="mt-0.5 text-[13px] font-bold text-slate-900 line-clamp-1">{t ? truncate(t, 72) : "Uten tittel"}</p>
          <p className="mt-1 text-[10px] font-medium text-slate-600">
            {introOk ? "Ingress aktiv" : "Uten ingress"} · Justering: {varLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 text-[9px] font-bold">
          <span className="rounded-full bg-white px-2 py-0.5 font-mono tabular-nums text-slate-800 ring-1 ring-slate-300/80">
            {cells} celler
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 text-slate-600 ring-1 ring-slate-200/90">{withMedia} m/ bilde</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 lg:flex-row">
        <div
          className={`grid w-full shrink-0 gap-1.5 self-start border border-dashed border-slate-400/40 bg-white/80 p-2 ${cols === 2 ? "max-w-[200px]" : "max-w-[240px]"}`}
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          data-lp-preview-grid-lattice
          aria-hidden
        >
          {Array.from({ length: n }).map((_, i) => (
            <div
              key={i}
              className="relative flex aspect-square flex-col justify-end rounded-md border-2 border-slate-300/80 bg-gradient-to-br from-slate-200/90 to-slate-300/70 p-1 shadow-inner"
            >
              <span className="mx-auto mb-1 block h-1.5 w-4 rounded-full bg-slate-500/85" />
              <span className="mx-auto block h-1 w-3 rounded-full bg-slate-400/90" />
              {i < withMeta ? (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-pink-500 ring-2 ring-pink-200/60" />
              ) : null}
            </div>
          ))}
          {cells > 6 ? (
            <span
              className="col-span-full pt-1 text-center text-[9px] font-mono font-medium text-slate-500"
              style={{ gridColumn: "1 / -1" }}
            >
              +{cells - 6} celler
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1 rounded-lg border border-slate-300/40 bg-white/70 p-2 font-mono text-[10px] font-semibold leading-relaxed text-slate-700">
          <p className="text-[9px] font-bold uppercase text-slate-500">Celle-metadata</p>
          <p className="mt-1 tabular-nums">
            undertittel {withSub}/{cells} · meta {withMeta}/{cells}
          </p>
          <div className="mt-2 grid grid-cols-4 gap-0.5 opacity-70" aria-hidden>
            {Array.from({ length: 8 }).map((_, g) => (
              <span key={g} className="aspect-square rounded-sm bg-slate-200/80" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
