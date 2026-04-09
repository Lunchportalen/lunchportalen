/**
 * Multi-page / site-level analysis (pure, client- or server-safe).
 */

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { tryParseBlockListFromBody } from "@/app/(backoffice)/backoffice/content/_components/bodyParse";
import { getBlockEntryFlatForRender, isBlockEntryModelAlias } from "@/lib/cms/blocks/blockEntryContract";
import { blockNodesToEditorBlocks } from "@/lib/cms/blockNodeToEditorBlock";
import { evaluatePage, hasEffectiveCta } from "@/lib/ai/pageScore";

export type SitePageInput = {
  id: string;
  title: string;
  /** Raw page body from CMS (variant body) */
  body: unknown;
};

export type SitePageDraft = SitePageInput & {
  blocks: Block[];
  meta: Record<string, unknown>;
};

export type PageSummary = {
  id: string;
  title: string;
  score: number;
  hasCTA: boolean;
  wordCount: number;
};

function extractMetaFromBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return {};
  const m = (body as { meta?: unknown }).meta;
  if (m && typeof m === "object" && !Array.isArray(m)) return m as Record<string, unknown>;
  return {};
}

function collectStringsFromUnknown(v: unknown, out: string[], depth = 0): void {
  if (depth > 4) return;
  if (typeof v === "string") {
    out.push(v);
    return;
  }
  if (Array.isArray(v)) {
    for (const el of v) collectStringsFromUnknown(el, out, depth + 1);
    return;
  }
  if (v && typeof v === "object") {
    for (const x of Object.values(v as Record<string, unknown>)) collectStringsFromUnknown(x, out, depth + 1);
  }
}

/** Approximate word count from visible text fields (Norwegian-friendly whitespace split). */
export function countWordsInBlocks(blocks: Block[]): number {
  const parts: string[] = [];
  for (const b of blocks) {
    if (isBlockEntryModelAlias(b.type)) {
      collectStringsFromUnknown(getBlockEntryFlatForRender(b), parts);
      continue;
    }
    switch (b.type) {
      case "richText":
        parts.push(b.heading ?? "", b.body);
        break;
      case "image":
        parts.push(b.alt ?? "", b.caption ?? "");
        break;
      case "banner":
        parts.push(b.text, b.ctaLabel ?? "");
        break;
      case "form":
        parts.push(b.title ?? "", b.formId);
        break;
      case "divider":
        break;
      default:
        break;
    }
  }
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

export function pageInputFromSiteBody(page: SitePageInput): {
  blocks: Block[];
  meta: Record<string, unknown>;
} {
  const parsed = tryParseBlockListFromBody(page.body);
  if (!parsed.ok) {
    return { blocks: [], meta: extractMetaFromBody(page.body) };
  }
  const blocks = blockNodesToEditorBlocks(parsed.list.blocks);
  const meta =
    parsed.list.meta && typeof parsed.list.meta === "object" && !Array.isArray(parsed.list.meta)
      ? (parsed.list.meta as Record<string, unknown>)
      : extractMetaFromBody(page.body);
  return { blocks, meta };
}

export function toSitePageDraft(page: SitePageInput): SitePageDraft {
  const { blocks, meta } = pageInputFromSiteBody(page);
  return { ...page, blocks, meta };
}

/**
 * Produces one summary row per page using the same scoring engine as the editor insights panel.
 */
export function analyzeSite(pages: SitePageInput[]): PageSummary[] {
  return pages.map((page) => {
    const { blocks, meta } = pageInputFromSiteBody(page);
    const score = evaluatePage({ title: page.title, blocks, meta }).score;
    return {
      id: page.id,
      title: page.title,
      score,
      hasCTA: hasEffectiveCta(blocks),
      wordCount: countWordsInBlocks(blocks),
    };
  });
}
