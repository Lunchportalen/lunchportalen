"use client";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import type { PricingPlanRow } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import { truncate } from "./canvasPreviewUtils";

/** U91: flat projection = samme som editor. */
export function PricingCanvasPreview({ block }: { block: Extract<Block, { type: "pricing" }> }) {
  const flat = getBlockEntryFlatForRender(block);
  const plans = (Array.isArray(flat.plans) ? flat.plans : []) as PricingPlanRow[];
  const n = plans.length;
  const t = String(flat.title || "").trim();
  const introOk = String(flat.intro || "").trim().length > 0;
  const featuredN = plans.filter((p) => p.featured).length;
  const withCta = plans.filter((p) => (p.ctaLabel || "").trim() && (p.ctaHref || "").trim()).length;
  const featLines = plans.reduce((acc, p) => acc + (Array.isArray(p.features) ? p.features.length : 0), 0);
  const periodHint = plans.some((p) => (p.period || "").trim());
  const slice = n === 0 ? [] : plans.slice(0, 3);

  return (
    <div
      className="min-w-0 rounded-xl border border-slate-300/70 bg-gradient-to-b from-slate-50/90 to-white p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.95)]"
      data-lp-block-preview
      data-lp-block-preview-kind="pricing"
      data-lp-canvas-view="pricing"
    >
      <div className="mb-3 border-b border-slate-200/90 pb-2">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-600">Pris · nivåer</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[13px] font-bold text-slate-900 line-clamp-1">{t ? truncate(t, 72) : "Prisblokk"}</p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">
              {n === 0 ? "Live priser (tom planliste)" : `${n} plan${n === 1 ? "" : "er"}`} ·{" "}
              {introOk ? "Ingress aktiv" : "Uten ingress"}
            </p>
          </div>
          <div className="flex flex-wrap gap-1 text-[9px] font-bold">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-950 ring-1 ring-amber-200/80">{featuredN} fremhevet</span>
            <span className="rounded-full bg-slate-200/80 px-2 py-0.5 text-slate-800">{withCta} med CTA</span>
            <span className="rounded-full bg-white px-2 py-0.5 tabular-nums text-slate-600 ring-1 ring-slate-200/90">{featLines} punkter</span>
            <span className={`rounded-full px-2 py-0.5 ${periodHint ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80" : "bg-slate-50 text-slate-400 ring-1 ring-slate-200/80"}`}>
              {periodHint ? "Periode satt" : "Ingen periode"}
            </span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" data-lp-preview-pricing-tiers aria-hidden>
        {n === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100/50 py-8">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Dynamiske priser</span>
            <span className="mt-1 text-[11px] text-slate-400">Ingen redaksjonelle planer i body</span>
          </div>
        ) : (
          slice.map((p, i) => {
            const priceOk = (p.price || "").trim();
            const ctaOk = (p.ctaLabel || "").trim() && (p.ctaHref || "").trim();
            const fc = Array.isArray(p.features) ? p.features.length : 0;
            return (
              <div
                key={i}
                className={`flex min-h-[108px] flex-col rounded-xl border px-2.5 pb-2 pt-2.5 ${
                  p.featured
                    ? "border-pink-400/80 bg-gradient-to-b from-pink-50/95 to-white shadow-md ring-2 ring-pink-300/50"
                    : "border-slate-200/95 bg-slate-50/80"
                }`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="max-w-[5.5rem] truncate text-[10px] font-bold text-slate-900">
                    {(p.name || "").trim() || `Plan ${i + 1}`}
                  </span>
                  {p.badge ? (
                    <span className="shrink-0 rounded bg-slate-900 px-1.5 py-px text-[8px] font-bold uppercase text-white">
                      {truncate(p.badge, 14)}
                    </span>
                  ) : null}
                </div>
                {p.featured ? (
                  <span className="mt-1 w-fit rounded-full bg-pink-600 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                    Anbefalt
                  </span>
                ) : (
                  <span className="mt-1 h-4" aria-hidden />
                )}
                <div className="mt-2 flex items-baseline gap-0.5">
                  <span className={`text-[14px] font-black tabular-nums ${priceOk ? "text-slate-900" : "text-slate-400"}`}>
                    {priceOk ? truncate(p.price, 12) : "—"}
                  </span>
                  {(p.period || "").trim() ? (
                    <span className="text-[8px] font-semibold uppercase text-slate-500">/{truncate(p.period!, 10)}</span>
                  ) : null}
                </div>
                <ul className="mt-2 flex-1 space-y-1" aria-hidden>
                  {Array.from({ length: Math.min(fc, 3) }).map((_, li) => (
                    <li key={li} className="flex items-center gap-1 text-[8px] text-slate-500">
                      <span className="h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      <span className="h-1.5 flex-1 rounded bg-slate-200/90" />
                    </li>
                  ))}
                  {fc > 3 ? <li className="text-[8px] font-medium text-slate-400">+{fc - 3} flere</li> : null}
                </ul>
                <span
                  className={`mt-2 rounded-md px-1.5 py-1 text-center text-[8px] font-bold uppercase ${
                    ctaOk ? "bg-pink-100 text-pink-900" : "bg-slate-200/70 text-slate-500"
                  }`}
                >
                  {ctaOk ? truncate(p.ctaLabel || "CTA", 18) : "Uten CTA"}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
