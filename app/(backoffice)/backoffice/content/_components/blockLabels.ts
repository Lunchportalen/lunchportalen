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
