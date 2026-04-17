"use client";

import type { Block } from "./editorBlockTypes";
import { buildBlockEntryTreeLabel, isBlockEntryModelAlias } from "@/lib/cms/blocks/blockEntryContract";
import { getBlockTypeDefinition } from "@/lib/cms/blocks/blockTypeDefinitions";
import type { ElementTypeRuntimeMergedEntry } from "@/lib/cms/schema/elementTypeRuntimeMerge";

/** Compact label for block chrome (toolbar / badges). */
export function getBlockShortLabel(type: string): string {
  const t = (type ?? "").trim();
  const c = getBlockTypeDefinition(t);
  if (c) return c.shortTitle;
  const raw = t;
  return raw ? raw.slice(0, 12).toUpperCase() : "UKJENT";
}

export function getBlockLabel(type: string): string {
  const t = (type ?? "").trim();
  const c = getBlockTypeDefinition(t);
  if (c) return c.title;
  const raw = t;
  return raw ? `Innholdstype «${raw}»` : "Ukjent innholdstype";
}

/** U96B — admin-merged element type title vinner over code-baseline. */
export function resolveElementRuntimeLabel(
  type: string,
  merged: Record<string, ElementTypeRuntimeMergedEntry> | null | undefined,
): string {
  const t = (type ?? "").trim();
  const title = merged?.[t]?.title?.trim();
  if (title) return title;
  return getBlockLabel(t);
}

function compactWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function truncateLabel(s: string, maxChars: number): string {
  const txt = compactWhitespace(s);
  if (txt.length <= maxChars) return txt;
  return txt.slice(0, Math.max(0, maxChars - 1)).trimEnd() + "…";
}

/**
 * Content-aware, short and stable label for the editor structure tree.
 * U91: nøkkelblokker bruker `buildBlockEntryTreeLabel` (samme kontrakt som library/preview).
 */
export function getBlockTreeLabel(block: Block): string {
  if (isBlockEntryModelAlias(block.type)) return buildBlockEntryTreeLabel(block);
  switch (block.type) {
    case "banner": {
      const t = (block.text ?? "").trim();
      return t ? truncateLabel(`Banner · ${t}`, 42) : "Banner";
    }
    case "richText": {
      const heading = (block.heading ?? "").trim();
      if (heading) return truncateLabel(`Tekst · ${heading}`, 42);
      const snippet = compactWhitespace(block.body ?? "").slice(0, 40);
      return snippet ? truncateLabel(`Tekst · ${snippet}`, 42) : "Tekstseksjon";
    }
    case "image": {
      const caption = (block.caption ?? "").trim();
      const alt = (block.alt ?? "").trim();
      const primary = caption || alt;
      return primary ? truncateLabel(`Bilde · ${primary}`, 42) : "Bilde";
    }
    case "divider": {
      return block.style === "space" ? "Skillelinje · luft" : "Skillelinje";
    }
    case "form": {
      const id = (block.formId ?? "").trim();
      return id ? truncateLabel(`Skjema · ${id}`, 42) : "Skjema";
    }
    default:
      return "Ukjent innholdstype";
  }
}

function stripHtmlTags(html: string): string {
  return compactWhitespace(html.replace(/<[^>]*>/g, " "));
}

/** Dokumentseksjon: redaksjonell overskrift fra innhold, ikke typekode. */
export function getBlockDocumentSectionHeading(block: Block): string {
  switch (block.type) {
    case "hero":
    case "hero_full":
    case "hero_bleed":
      return (block.contentData?.title ?? "").trim() || getBlockLabel(block.type);
    case "richText": {
      const h = (block.heading ?? "").trim();
      if (h) return h;
      const plain = stripHtmlTags(block.body ?? "");
      if (plain.length > 0) return truncateLabel(plain, 100);
      return "Tekstseksjon";
    }
    case "image": {
      const c = (block.caption ?? "").trim();
      const a = (block.alt ?? "").trim();
      return c || a || "Bilde";
    }
    case "cta":
      return (block.contentData?.title ?? "").trim() || "Handlingsseksjon";
    case "banner": {
      const t = stripHtmlTags(block.text ?? "");
      return t.length > 0 ? truncateLabel(t, 100) : "Banner";
    }
    case "cards":
      return (block.contentData?.title ?? "").trim() || "Verdikort";
    case "zigzag":
      return (block.contentData?.title ?? "").trim() || "Stegseksjon";
    case "pricing":
      return (block.contentData?.title ?? "").trim() || "Priser";
    case "grid":
      return (block.contentData?.title ?? "").trim() || "Rutenett";
    case "form": {
      const t = (block.title ?? "").trim();
      return t || (block.formId ? `Skjema · ${block.formId}` : "Skjema");
    }
    case "relatedLinks":
      return (block.contentData?.title ?? "").trim() || "Relaterte lenker";
    case "divider":
      return block.style === "space" ? "Luft" : "Skille";
    default: {
      const b = block as unknown as Block;
      if (isBlockEntryModelAlias(b.type)) {
        const tree = buildBlockEntryTreeLabel(b);
        return tree.length > 0 ? truncateLabel(tree, 120) : getBlockLabel(b.type);
      }
      return getBlockLabel(b.type);
    }
  }
}

/** 1–3 linjer med synlig innhold under seksjonstittel (dokumentflyt). */
export function getBlockDocumentLeadLines(block: Block): string[] {
  const out: string[] = [];
  const push = (s: string, max = 220) => {
    const t = compactWhitespace(s);
    if (!t || out.length >= 3) return;
    out.push(t.length > max ? `${t.slice(0, max - 1)}…` : t);
  };

  switch (block.type) {
    case "hero":
    case "hero_full":
      push(block.contentData?.subtitle ?? "");
      if (block.contentData?.ctaLabel?.trim()) push(`Knapp: ${block.contentData.ctaLabel.trim()}`);
      break;
    case "hero_bleed":
      push(block.contentData?.subtitle ?? "");
      if (block.contentData?.ctaPrimary?.trim()) push(`Primær: ${block.contentData.ctaPrimary.trim()}`);
      if (block.contentData?.ctaSecondary?.trim()) push(`Sekundær: ${block.contentData.ctaSecondary.trim()}`);
      break;
    case "richText": {
      const plain = stripHtmlTags(block.body ?? "");
      const hasHeading = Boolean((block.heading ?? "").trim());
      if (plain && (hasHeading || plain.length > 40)) push(plain, 320);
      break;
    }
    case "image": {
      const c = (block.caption ?? "").trim();
      const a = (block.alt ?? "").trim();
      if (c && a && c !== a) push(`${c} · ${a}`, 200);
      else if (c) push(c);
      else if (a) push(`Alt: ${a}`);
      break;
    }
    case "cta": {
      if (block.contentData?.eyebrow?.trim()) push(block.contentData.eyebrow.trim());
      if (block.contentData?.body?.trim()) push(block.contentData.body.trim(), 280);
      if (block.structureData?.buttonLabel?.trim()) push(`Knapp: ${block.structureData.buttonLabel.trim()}`);
      break;
    }
    case "banner":
      if (block.ctaLabel?.trim()) push(`CTA: ${block.ctaLabel.trim()}`);
      break;
    case "cards": {
      if (block.contentData?.text?.trim()) push(block.contentData.text.trim(), 260);
      const first = block.structureData?.items?.[0];
      if (first?.title?.trim()) push(`Kort: ${first.title.trim()}${first.text?.trim() ? ` — ${first.text.trim().slice(0, 120)}` : ""}`, 240);
      break;
    }
    case "zigzag": {
      if (block.contentData?.intro?.trim()) push(block.contentData.intro.trim(), 240);
      const s0 = block.structureData?.steps?.[0];
      if (s0?.title?.trim()) push(`Steg 1: ${s0.title.trim()}${s0.text?.trim() ? ` — ${s0.text.trim().slice(0, 100)}` : ""}`, 220);
      break;
    }
    case "pricing": {
      if (block.contentData?.intro?.trim()) push(block.contentData.intro.trim(), 240);
      const p0 = block.structureData?.plans?.[0];
      if (p0?.name?.trim()) {
        const price = [p0.price, p0.period].filter(Boolean).join(" · ");
        push(`${p0.name.trim()}${price ? ` — ${price}` : ""}${p0.tagline?.trim() ? ` · ${p0.tagline.trim()}` : ""}`, 200);
      }
      break;
    }
    case "grid": {
      if (block.contentData?.intro?.trim()) push(block.contentData.intro.trim(), 240);
      const g0 = block.structureData?.items?.[0];
      if (g0?.title?.trim()) {
        push(
          `${g0.title.trim()}${g0.subtitle?.trim() ? ` · ${g0.subtitle.trim()}` : ""}${g0.metaLine?.trim() ? ` · ${g0.metaLine.trim()}` : ""}`,
          220,
        );
      }
      break;
    }
    case "form":
      if (block.title?.trim() && block.formId) push(`Skjemareferanse: ${block.formId}`);
      break;
    case "relatedLinks": {
      if (block.contentData?.subtitle?.trim()) push(block.contentData.subtitle.trim(), 200);
      const tags = block.structureData?.tags?.filter(Boolean) ?? [];
      if (tags.length) push(`Tagger: ${tags.slice(0, 6).join(", ")}`, 160);
      break;
    }
    default: {
      const b = block as unknown as Block;
      if (isBlockEntryModelAlias(b.type)) {
        return out;
      }
      break;
    }
  }
  return out;
}
