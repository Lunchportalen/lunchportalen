"use client";

import type { Block } from "./editorBlockTypes";
import {
  CardsCanvasPreview,
  CtaCanvasPreview,
  GridCanvasPreview,
  HeroCanvasPreview,
  PricingCanvasPreview,
  RelatedLinksCanvasPreview,
  StepsCanvasPreview,
} from "@/components/cms/blockCanvas";
import { stripTags, truncate } from "@/components/cms/blockCanvas/canvasPreviewUtils";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";

function countFilledCards(block: Extract<Block, { type: "cards" }>): { total: number; filled: number } {
  const items = block.structureData.items ?? [];
  const filled = items.filter((it) => (it.title ?? "").trim() && (it.text ?? "").trim()).length;
  return { total: items.length, filled };
}

function countSteps(block: Extract<Block, { type: "zigzag" }>): { total: number; complete: number } {
  const steps = block.structureData.steps ?? [];
  let complete = 0;
  for (const st of steps) {
    const img = (st.imageId ?? "").trim();
    if ((st.title ?? "").trim() && (st.text ?? "").trim() && img) complete += 1;
  }
  return { total: steps.length, complete };
}

function variantLabelHeroFull(block: Extract<Block, { type: "hero_full" }>): string {
  return block.settingsData.useGradient === false ? "Uten gradient-overlay" : "Med gradient-overlay";
}

function variantLabelHeroBleed(block: Extract<Block, { type: "hero_bleed" }>): string {
  const v = String(block.settingsData.variant ?? "").trim();
  const align = block.settingsData.textAlign ?? "center";
  const parts = [v ? `Variant ${v}` : null, `Tekst: ${align}`].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Standard layout";
}

/** Brukes av tester for å verifisere sammendrag uten React-render. */
export function blockCollapsedPreviewSummary(block: Block): string {
  switch (block.type) {
    case "hero":
    case "hero_full": {
      const flat = getBlockEntryFlatForRender(block);
      const title = String(flat.title || "").trim();
      const sub = String(flat.subtitle || "").trim();
      const thumb = String(flat.imageId || "").trim();
      const cta = String(flat.ctaLabel || "").trim();
      const parts = [
        title ? truncate(title, 100) : "Mangler tittel",
        sub ? `Undertittel: ${truncate(sub, 56)}` : "Ingen undertittel",
        thumb ? "Bilde OK" : "Mangler bilde",
        cta ? `Primær CTA: ${truncate(cta, 36)}` : "Ingen primær CTA",
        block.type === "hero_full" ? variantLabelHeroFull(block) : null,
      ].filter(Boolean);
      return parts.join(" · ");
    }
    case "hero_bleed": {
      const flat = getBlockEntryFlatForRender(block);
      const title = String(flat.title || "").trim();
      const sub = String(flat.subtitle || "").trim();
      const thumb = String(flat.backgroundImageId || "").trim();
      const pri = String(flat.ctaPrimary || "").trim();
      const sec = String(flat.ctaSecondary || "").trim();
      return [
        title ? truncate(title, 88) : "Mangler tittel",
        sub ? `Undertittel: ${truncate(sub, 48)}` : "Ingen undertittel",
        thumb ? "Bakgrunn OK" : "Mangler bakgrunn",
        pri ? `Primær: ${truncate(pri, 28)}` : "Primær CTA mangler",
        sec ? `Sekundær: ${truncate(sec, 28)}` : null,
        variantLabelHeroBleed(block),
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "banner": {
      const text = (block.text || "").trim();
      const cta = (block.ctaLabel || "").trim();
      return [text ? truncate(text, 100) : "Mangler tekst", cta ? `CTA: ${truncate(cta, 32)}` : "Ingen CTA"].join(
        " · ",
      );
    }
    case "richText": {
      const h = (block.heading || "").trim();
      const body = truncate(stripTags(block.body || ""), 140);
      return h ? `${truncate(h, 80)} · ${body || "Tom brødtekst"}` : body || "Tom tekstseksjon";
    }
    case "image": {
      const src = (block.imageId || "").trim();
      return src ? truncate((block.caption || block.alt || "Bilde").trim(), 100) : "Mangler bilde";
    }
    case "cta": {
      const flat = getBlockEntryFlatForRender(block);
      const primary = String(flat.buttonLabel || "").trim();
      const secondary = String(flat.secondaryButtonLabel || "").trim();
      const bodyOk = String(flat.body || "").trim() ? "Støttetekst: ja" : "Støttetekst: nei";
      const eyebrow = String(flat.eyebrow || "").trim();
      return [
        eyebrow ? `Kontekst: ${truncate(eyebrow, 36)}` : null,
        primary ? `Primær: ${truncate(primary, 40)}` : "Mangler primær knapp",
        secondary ? `Sekundær: ${truncate(secondary, 40)}` : "Sekundær: —",
        bodyOk,
      ]
        .filter(Boolean)
        .join(" · ");
    }
    case "divider":
      return block.style === "space" ? "Skille · luft (mellomrom uten linje)" : "Skille · tynn linje mellom seksjoner";
    case "cards": {
      const { total, filled } = countFilledCards(block);
      const flat = getBlockEntryFlatForRender(block);
      const pres =
        flat.presentation === "plain" ? "Rolig kortflate (uten ikonring)" : "Ikonring (verdiforslag)";
      const t = String(flat.title || "").trim();
      const intro = String(flat.text ?? "").trim() ? "Ingress: ja" : "Ingress: nei";
      const ctaArr = Array.isArray(flat.cta) ? flat.cta : [];
      const ctaN = ctaArr.filter((c: unknown) => {
        const o = c as Record<string, unknown>;
        return String(o.label ?? "").trim() && String(o.href ?? "").trim();
      }).length;
      return [
        t ? truncate(t, 64) : "Uten seksjonstittel",
        `${total} kort · ${filled} komplette`,
        intro,
        pres,
        ctaN ? `Seksjons-CTA: ${ctaN}` : "Seksjons-CTA: ingen",
      ].join(" · ");
    }
    case "zigzag": {
      const { total, complete } = countSteps(block);
      const flat = getBlockEntryFlatForRender(block);
      const mode =
        flat.presentation === "faq" ? "Modus: spørsmål/svar (FAQ)" : "Modus: prosess (steg for steg)";
      const t = String(flat.title || "").trim();
      const intro = String(flat.intro || "").trim() ? "Ingress: ja" : "Ingress: nei";
      return [
        t ? truncate(t, 64) : "Uten seksjonstittel",
        `${total} steg · ${complete} komplette`,
        intro,
        mode,
      ].join(" · ");
    }
    case "pricing": {
      const flat = getBlockEntryFlatForRender(block);
      const plans = Array.isArray(flat.plans) ? flat.plans : [];
      const n = plans.length;
      const t = String(flat.title || "").trim();
      if (n === 0) {
        return `${t ? truncate(t, 64) : "Prisblokk"} · 0 planer · Live priser (tom planliste)`;
      }
      const feat = plans.filter((p: unknown) => (p as { featured?: boolean }).featured).length ?? 0;
      const withCta =
        plans.filter(
          (p: unknown) =>
            String((p as Record<string, unknown>).ctaLabel ?? "").trim() &&
            String((p as Record<string, unknown>).ctaHref ?? "").trim(),
        ).length ?? 0;
      const featLines =
        plans.reduce(
          (acc: number, p: unknown) =>
            acc + (Array.isArray((p as { features?: unknown[] }).features) ? (p as { features: unknown[] }).features.length : 0),
          0,
        ) ?? 0;
      const periodHint = plans.some((p: unknown) => String((p as Record<string, unknown>).period ?? "").trim())
        ? "Periode på minst én plan"
        : "Ingen prisperiode satt";
      return [
        t ? truncate(t, 56) : "Prisblokk",
        `${n} plan${n === 1 ? "" : "er"}`,
        `${feat} fremhevet`,
        `${withCta} med CTA`,
        `${featLines} punkter (features) totalt`,
        periodHint,
      ].join(" · ");
    }
    case "grid": {
      const flat = getBlockEntryFlatForRender(block);
      const items = Array.isArray(flat.items) ? flat.items : [];
      const cells = items.length;
      const withMedia =
        items.filter((it: unknown) => {
          const o = it as Record<string, unknown>;
          return String(o.imageId ?? "").trim() && String(o.title ?? "").trim();
        }).length ?? 0;
      const withSub = items.filter((it: unknown) => String((it as Record<string, unknown>).subtitle ?? "").trim()).length ?? 0;
      const withMeta = items.filter((it: unknown) => String((it as Record<string, unknown>).metaLine ?? "").trim()).length ?? 0;
      const t = String(flat.title || "").trim();
      const intro = String(flat.intro || "").trim() ? "Ingress: ja" : "Ingress: nei";
      const varLabel = String(flat.variant ?? "center").trim();
      return [
        t ? truncate(t, 56) : "Lokasjonsrutenett",
        `Rutenett · ${cells} celler · ${withMedia} med bilde+tittel`,
        intro,
        `Undertittel: ${withSub}/${cells} · Meta: ${withMeta}/${cells}`,
        `Justering: ${varLabel}`,
      ].join(" · ");
    }
    case "form": {
      const id = (block.formId || "").trim();
      return id ? `Skjema · ${truncate(id, 48)}` : "Mangler skjema-ID";
    }
    case "relatedLinks": {
      const flat = getBlockEntryFlatForRender(block);
      const tags = Array.isArray(flat.tags) ? flat.tags : [];
      const n = tags.length;
      const max = flat.maxSuggestions as number | undefined;
      const intro = String(flat.subtitle || "").trim() ? "Ingress: ja" : "Ingress: nei";
      const fb = String(flat.emptyFallbackText || "").trim() ? "Tomtilstand: egen tekst" : "Tomtilstand: standard";
      const path = String(flat.currentPath || "").trim();
      return [
        `Stikkord: ${n}`,
        max != null ? `Maks ${max} forslag` : "Maks: systemstandard",
        intro,
        fb,
        path ? `Skjul aktiv side: ${truncate(path, 40)}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
    }
  }
}

export function BlockCollapsedPreview({ block }: { block: Block }) {
  switch (block.type) {
    case "hero":
    case "hero_full":
    case "hero_bleed":
      return <HeroCanvasPreview block={block} />;
    case "cards":
      return <CardsCanvasPreview block={block} />;
    case "zigzag":
      return <StepsCanvasPreview block={block} />;
    case "pricing":
      return <PricingCanvasPreview block={block} />;
    case "cta":
      return <CtaCanvasPreview block={block} />;
    case "relatedLinks":
      return <RelatedLinksCanvasPreview block={block} />;
    case "grid":
      return <GridCanvasPreview block={block} />;
    case "banner": {
      const thumb = (block.backgroundImageId || "").trim();
      const text = (block.text || "").trim();
      const cta = (block.ctaLabel || "").trim();
      return (
        <div
          className="flex min-w-0 overflow-hidden rounded-lg border border-amber-200/70 bg-gradient-to-r from-amber-50/80 to-white"
          data-lp-block-preview
          data-lp-block-preview-kind="banner"
          data-lp-canvas-view="banner"
        >
          {thumb ? (
            <img src={thumb} alt="" className="h-[72px] w-24 shrink-0 object-cover" />
          ) : (
            <div className="flex h-[72px] w-20 shrink-0 items-center justify-center border-r border-amber-200/60 bg-amber-100/50 text-[8px] font-bold text-amber-800">
              Banner
            </div>
          )}
          <div className="min-w-0 flex-1 p-2">
            <p className="text-[10px] font-black uppercase tracking-wide text-amber-900">Strip / promo</p>
            <p className="mt-0.5 text-[11px] font-semibold leading-snug text-slate-800 line-clamp-2">
              {text ? truncate(text, 140) : "Mangler budskap"}
            </p>
            <span
              className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold ${
                cta ? "bg-amber-600 text-white" : "border border-dashed border-amber-300 text-amber-600"
              }`}
            >
              {cta ? truncate(cta, 32) : "CTA mangler"}
            </span>
          </div>
        </div>
      );
    }
    case "richText": {
      const h = (block.heading || "").trim();
      const bodyPreview = truncate(stripTags(block.body || ""), 160);
      return (
        <div
          className="min-w-0 rounded-lg border border-slate-200/90 bg-white p-2"
          data-lp-block-preview
          data-lp-block-preview-kind="richText"
          data-lp-canvas-view="richText"
        >
          <div className="mb-1.5 border-b border-slate-100 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Tekstseksjon</span>
            <p className="text-[12px] font-bold text-slate-900 line-clamp-2">{h || "Uten overskrift"}</p>
          </div>
          <div className="space-y-1" aria-hidden>
            <span className="block h-2 w-full rounded bg-slate-200/90" />
            <span className="block h-2 w-[94%] rounded bg-slate-200/75" />
            <span className="block h-2 w-[88%] rounded bg-slate-200/60" />
          </div>
          {bodyPreview ? (
            <p className="mt-1.5 text-[10px] leading-snug text-slate-600 line-clamp-2">{bodyPreview}</p>
          ) : null}
        </div>
      );
    }
    case "image": {
      const src = (block.imageId || "").trim();
      return (
        <div
          className="flex min-w-0 gap-2 rounded-lg border border-slate-200/90 bg-slate-50/50 p-2"
          data-lp-block-preview
          data-lp-block-preview-kind="image"
          data-lp-canvas-view="image"
        >
          {src ? (
            <img src={src} alt="" className="h-20 w-[30%] max-w-[120px] shrink-0 rounded-md border border-slate-200 object-cover" />
          ) : (
            <div className="flex h-20 w-[30%] max-w-[120px] shrink-0 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-[9px] font-bold text-slate-400">
              Ingen media
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase text-slate-500">Enkeltbilde</p>
            <p className="mt-1 text-[11px] font-medium text-slate-700 line-clamp-2">
              {(block.caption || "").trim() || (block.alt || "").trim() || "Uten bildetekst / alt"}
            </p>
          </div>
        </div>
      );
    }
    case "divider": {
      const space = block.style === "space";
      return (
        <div
          className="min-w-0 rounded-md border border-slate-200/80 bg-white px-2 py-2"
          data-lp-block-preview
          data-lp-block-preview-kind="divider"
          data-lp-canvas-view="divider"
        >
          <span className="text-[9px] font-bold uppercase text-slate-400">Skillelinje</span>
          {space ? (
            <div className="mt-2 flex h-8 items-center justify-center text-[10px] font-medium text-slate-400">Luft · ingen linje</div>
          ) : (
            <div className="mt-2 h-px w-full bg-gradient-to-r from-transparent via-slate-300 to-transparent" />
          )}
        </div>
      );
    }
    case "form": {
      const id = (block.formId || "").trim();
      return (
        <div
          className="min-w-0 rounded-lg border border-blue-200/70 bg-blue-50/30 p-2"
          data-lp-block-preview
          data-lp-block-preview-kind="form"
          data-lp-canvas-view="form"
        >
          <p className="text-[9px] font-black uppercase text-blue-900">Skjemablokk</p>
          <div className="mt-1 space-y-1" aria-hidden>
            <span className="block h-2.5 rounded border border-blue-200/80 bg-white" />
            <span className="block h-2.5 w-[90%] rounded border border-blue-200/80 bg-white" />
            <span className="block h-6 rounded border border-blue-300/80 bg-blue-100/50" />
          </div>
          <p className="mt-1.5 font-mono text-[10px] font-semibold text-blue-950">{id || "Mangler skjema-ID"}</p>
        </div>
      );
    }
  }
}
