"use client";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import { truncate } from "./canvasPreviewUtils";

/** U91: flat projection = samme som editor. */
export function CtaCanvasPreview({ block }: { block: Extract<Block, { type: "cta" }> }) {
  const flat = getBlockEntryFlatForRender(block);
  const primary = String(flat.buttonLabel || "").trim();
  const secondary = String(flat.secondaryButtonLabel || "").trim();
  const bodyOk = String(flat.body || "").trim().length > 0;
  const eyebrow = String(flat.eyebrow || "").trim();
  const title = String(flat.title || "").trim();

  return (
    <div
      className="min-w-0 overflow-hidden rounded-xl border border-pink-200/60 bg-gradient-to-br from-pink-50/80 via-white to-white shadow-[0_8px_30px_rgba(219,39,119,0.08)]"
      data-lp-block-preview
      data-lp-block-preview-kind="cta"
      data-lp-canvas-view="cta"
    >
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-stretch sm:gap-4">
        <div className="min-w-0 flex-1 rounded-lg border border-white/80 bg-white/90 p-3 shadow-sm sm:p-4">
          {eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-pink-700">{truncate(eyebrow, 52)}</p>
          ) : (
            <p className="text-[10px] font-medium italic text-slate-400">Uten kontekstlinje (eyebrow)</p>
          )}
          <p className="mt-2 text-[16px] font-bold leading-tight tracking-tight text-slate-900 line-clamp-3">
            {title ? truncate(title, 120) : "Mangler CTA-overskrift"}
          </p>
          <div className="mt-2">
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[9px] font-bold ${
                bodyOk ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/70" : "bg-slate-100 text-slate-400"
              }`}
            >
              {bodyOk ? "Støttetekst aktiv" : "Ingen støttetekst"}
            </span>
          </div>
          {bodyOk ? (
            <div className="mt-3 space-y-1.5" aria-hidden>
              <span className="block h-2 w-full rounded-md bg-slate-200/90" />
              <span className="block h-2 w-[92%] rounded-md bg-slate-200/75" />
              <span className="block h-2 w-[78%] rounded-md bg-slate-200/65" />
            </div>
          ) : null}
        </div>
        <div
          className="flex shrink-0 flex-col justify-center gap-2 rounded-lg border border-pink-100/90 bg-pink-50/40 p-3 sm:w-[40%] sm:max-w-[200px]"
          data-lp-preview-cta-actions
          aria-hidden
        >
          <p className="text-[9px] font-bold uppercase tracking-wide text-pink-900">Handlinger</p>
          <span className="flex min-h-[40px] items-center justify-center rounded-lg border border-pink-400/70 bg-pink-500 px-3 text-center text-[11px] font-bold text-white shadow-md">
            {primary ? truncate(primary, 28) : "Primær"}
          </span>
          {secondary ? (
            <span className="flex min-h-[36px] items-center justify-center rounded-lg border border-slate-300/90 bg-white px-3 text-center text-[11px] font-semibold text-slate-800">
              {truncate(secondary, 28)}
            </span>
          ) : (
            <span className="flex min-h-[36px] items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 text-[10px] text-slate-400">
              Ingen sekundær
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
