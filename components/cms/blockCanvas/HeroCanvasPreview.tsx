"use client";

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";
import { truncate } from "./canvasPreviewUtils";

function variantLabelHeroFull(block: Extract<Block, { type: "hero_full" }>): string {
  return block.settingsData.useGradient === false ? "Uten gradient" : "Gradient-overlay";
}

function variantLabelHeroBleed(block: Extract<Block, { type: "hero_bleed" }>): string {
  const v = (block.settingsData.variant ?? "").trim();
  const align = block.settingsData.textAlign ?? "center";
  const parts = [v ? `Layout ${v}` : null, `${align}`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Standard";
}

type Heroish = Extract<Block, { type: "hero" | "hero_full" | "hero_bleed" }>;

/** U91: leser samme kontrakt som property editor via flattening. */
export function HeroCanvasPreview({ block }: { block: Heroish }) {
  const flat = getBlockEntryFlatForRender(block);
  const isBleed = block.type === "hero_bleed";
  const title = String(flat.title || "").trim();
  const sub = String(flat.subtitle || "").trim();
  const img = isBleed
    ? String(flat.backgroundImageId || "").trim()
    : String(flat.imageId || "").trim();
  const ctaPrimary = isBleed ? String(flat.ctaPrimary || "").trim() : String(flat.ctaLabel || "").trim();
  const ctaSecondary = isBleed ? String(flat.ctaSecondary || "").trim() : "";

  const variantLine =
    block.type === "hero_full"
      ? variantLabelHeroFull(block)
      : block.type === "hero_bleed"
        ? variantLabelHeroBleed(block)
        : "Standard hero";

  const surface =
    block.type === "hero_full" ? "full-bleed-image" : block.type === "hero_bleed" ? "bleed" : "contained";

  return (
    <div
      className="min-w-0 overflow-hidden rounded-xl border border-slate-200/80 bg-gradient-to-br from-slate-100/90 via-white to-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
      data-lp-block-preview
      data-lp-block-preview-kind={block.type}
      data-lp-preview-hero-surface={surface}
      data-lp-canvas-view="hero"
    >
      <div className="flex min-h-[128px] flex-col sm:min-h-[140px] sm:flex-row">
        <div
          className={`relative min-h-[112px] shrink-0 sm:w-[42%] sm:min-h-[140px] ${img ? "" : "bg-gradient-to-br from-slate-300/80 to-slate-400/60"}`}
        >
          {img ? (
            <img src={img} alt="" className="h-full min-h-[112px] w-full object-cover sm:min-h-[140px]" />
          ) : (
            <div className="flex h-full min-h-[112px] flex-col items-center justify-center gap-2 px-3 py-4 sm:min-h-[140px]">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-600">Hero-media</span>
              <span className="rounded-full border border-dashed border-slate-500/50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                Mangler bilde
              </span>
            </div>
          )}
          {block.type === "hero_full" ? (
            <span className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              Full bredde
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 border-t border-slate-200/70 p-3 sm:border-l sm:border-t-0 sm:p-4">
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Landing · hero</p>
            <p className="text-[15px] font-bold leading-[1.15] tracking-tight text-slate-900 line-clamp-3 sm:text-[16px]">
              {title ? truncate(title, 120) : "Mangler hero-overskrift"}
            </p>
          </div>
          {sub ? (
            <p className="text-[11px] font-medium leading-relaxed text-slate-600 line-clamp-3">{truncate(sub, 160)}</p>
          ) : (
            <p className="text-[11px] italic text-slate-400">Ingen undertittel / intro</p>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                ctaPrimary
                  ? "border border-pink-300/90 bg-pink-50 text-pink-950 shadow-sm"
                  : "border border-dashed border-slate-300 bg-white text-slate-400"
              }`}
            >
              {ctaPrimary ? truncate(ctaPrimary, 32) : "Primær CTA mangler"}
            </span>
            {isBleed && ctaSecondary ? (
              <span className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-800 shadow-sm">
                {truncate(ctaSecondary, 28)}
              </span>
            ) : null}
            <span className="rounded-full border border-slate-200/90 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500">
              {variantLine}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                img ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200/80" : "bg-amber-50 text-amber-900 ring-1 ring-amber-200/70"
              }`}
            >
              {img ? "Media OK" : "Media tom"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
