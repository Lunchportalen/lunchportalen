"use client";

import type { Block } from "./editorBlockTypes";

type KnownBlockType =
  | "hero"
  | "richText"
  | "image"
  | "cta"
  | "divider"
  | "banners"
  | "code";

export function getBlockLabel(type: string): string {
  const t = (type ?? "").trim() as KnownBlockType;
  switch (t) {
    case "hero":
      return "Hero-seksjon";
    case "richText":
      return "Tekstseksjon";
    case "image":
      return "Bilde";
    case "cta":
      return "CTA / handlingsseksjon";
    case "divider":
      return "Skillelinje";
    case "banners":
      return "Bannere";
    case "code":
      return "Kodeblokk";
    default:
      return "Blokk";
  }
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
 * Must not be noisy: prefer primary identifiers (title/heading/button label/count).
 */
export function getBlockTreeLabel(block: Block): string {
  switch (block.type) {
    case "hero": {
      const title = (block.title ?? "").trim();
      const subtitle = (block.subtitle ?? "").trim();
      const cta = (block.ctaLabel ?? "").trim();
      const primary = title || subtitle || cta;
      return primary ? truncateLabel(`Hero · ${primary}`, 42) : "Hero-seksjon";
    }
    case "richText": {
      const heading = (block.heading ?? "").trim();
      if (heading) return truncateLabel(`Tekst · ${heading}`, 42);
      // body may contain newlines; keep first stable snippet.
      const snippet = compactWhitespace(block.body ?? "").slice(0, 40);
      return snippet ? truncateLabel(`Tekst · ${snippet}`, 42) : "Tekstseksjon";
    }
    case "image": {
      const caption = (block.caption ?? "").trim();
      const alt = (block.alt ?? "").trim();
      const primary = caption || alt;
      return primary ? truncateLabel(`Bilde · ${primary}`, 42) : "Bilde";
    }
    case "cta": {
      const button = (block.buttonLabel ?? "").trim();
      const title = (block.title ?? "").trim();
      const primary = button || title;
      return primary ? truncateLabel(`CTA · ${primary}`, 42) : "CTA / handlingsseksjon";
    }
    case "divider": {
      return block.style === "space" ? "Skillelinje · luft" : "Skillelinje";
    }
    case "banners": {
      const count = Array.isArray(block.items) ? block.items.length : 0;
      return count > 0 ? `Bannere · ${count}` : "Bannere";
    }
    case "code": {
      const intro = block.displayIntro ? (block.code ?? "").split("\n")[0]?.trim() : "";
      return intro ? truncateLabel(`Kode · ${intro}`, 42) : "Kodeblokk";
    }
    default:
      return "Blokk";
  }
}

