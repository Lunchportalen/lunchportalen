"use client";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import type { CardRow } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import { truncate } from "./canvasPreviewUtils";

function countFilledFromFlat(flat: Record<string, unknown>): { total: number; filled: number } {
  const items = (Array.isArray(flat.items) ? flat.items : []) as CardRow[];
  const filled = items.filter((it) => (it.title ?? "").trim() && (it.text ?? "").trim()).length;
  return { total: items.length, filled };
}

/** U91: flat projection = samme som editor. */
export function CardsCanvasPreview({ block }: { block: Extract<Block, { type: "cards" }> }) {
  const flat = getBlockEntryFlatForRender(block);
  const { total, filled } = countFilledFromFlat(flat);
  const pres =
    flat.presentation === "plain" ? "Rolig kortflate (uten ikonring)" : "Ikonring (verdiforslag)";
  const t = String(flat.title || "").trim();
  const introOk = String(flat.text ?? "").trim().length > 0;
  const ctaArr = Array.isArray(flat.cta) ? flat.cta : [];
  const ctaN = ctaArr.filter(
    (c: unknown) =>
      String((c as { label?: string }).label ?? "").trim() && String((c as { href?: string }).href ?? "").trim(),
  ).length;
  const items = (Array.isArray(flat.items) ? flat.items : []) as CardRow[];
  const slice = items.slice(0, 3);
  const show = slice.length
    ? slice
    : [{ title: "", text: "" }, { title: "", text: "" }].slice(0, Math.min(2, Math.max(1, total)));

  return (
    <div
      className="min-w-0 rounded-xl border border-amber-200/50 bg-gradient-to-b from-white to-amber-50/20 p-3 shadow-sm"
      data-lp-block-preview
      data-lp-block-preview-kind="cards"
      data-lp-canvas-view="cards"
    >
      <header className="mb-3 border-b border-amber-100/80 pb-2.5">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-amber-900/80">Seksjon · verdikort</p>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[13px] font-bold leading-tight text-slate-900 line-clamp-2">
              {t ? truncate(t, 88) : "Uten seksjonstittel"}
            </p>
            <p className="mt-1 text-[10px] font-medium text-slate-500">
              {introOk ? "Ingress aktiv" : "Uten ingress"} · {pres}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[9px] font-bold tabular-nums text-amber-950">
              {total} kort
            </span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold tabular-nums text-slate-700">
              {filled} komplette
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                ctaN ? "bg-pink-50 text-pink-900 ring-1 ring-pink-200/70" : "bg-slate-50 text-slate-400 ring-1 ring-slate-200/80"
              }`}
            >
              Seksjons-CTA: {ctaN || "—"}
            </span>
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2" data-lp-preview-card-stack aria-hidden>
        {show.map((it, i) => {
          const ok = (it.title || "").trim() && (it.text || "").trim();
          return (
            <div
              key={i}
              className={`flex min-h-[64px] min-w-0 flex-1 flex-col rounded-lg border p-2 shadow-[0_1px_0_rgba(15,23,42,0.04)] ${
                ok ? "border-slate-200/95 bg-white" : "border-dashed border-slate-300/90 bg-amber-50/30"
              }`}
            >
              <div className="flex items-start gap-2">
                {flat.presentation !== "plain" ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-pink-200/80 bg-pink-50 text-[10px] font-bold text-pink-900">
                    {(it.title || "?").trim().slice(0, 1).toUpperCase() || "·"}
                  </span>
                ) : (
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-400/90" />
                )}
                <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                  <span className="block h-2.5 w-[78%] max-w-full rounded-md bg-slate-300/90" />
                  <span className="block h-2 w-full rounded-md bg-slate-200/90" />
                  <span className="block h-2 w-[90%] rounded-md bg-slate-200/75" />
                </div>
              </div>
            </div>
          );
        })}
        {total > 3 ? (
          <div className="flex w-full min-w-[2.5rem] shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-amber-300/80 bg-amber-50/40 py-3 text-[10px] font-bold text-amber-900 sm:w-10 sm:py-0">
            +{total - 3}
          </div>
        ) : null}
      </div>
      {ctaN > 0 ? (
        <div className="mt-3 flex justify-end border-t border-amber-100/70 pt-2">
          <span className="rounded-lg border border-pink-200/80 bg-pink-50/80 px-2.5 py-1 text-[10px] font-bold text-pink-950">
            Seksjons-handling · {ctaN}
          </span>
        </div>
      ) : (
        <div className="mt-2 text-[9px] font-medium text-slate-400">Ingen seksjons-CTA definert</div>
      )}
    </div>
  );
}
