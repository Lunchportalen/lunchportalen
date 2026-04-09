/**
 * Deterministic SEO + CRO page scoring (client-safe, no network).
 */

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender } from "@/lib/cms/blocks/blockEntryContract";

export type PageScoreMetaInput = {
  /** SEO meta description (from meta.seo.description in editor) */
  description?: string;
  /** SEO title override */
  seoTitle?: string;
};

export type PageScoreInput = {
  title: string;
  blocks: Block[];
  meta?: PageScoreMetaInput | Record<string, unknown> | null;
};

export type PageScore = {
  score: number;
  issues: string[];
  strengths: string[];
};

function metaDescription(meta: PageScoreInput["meta"]): string {
  if (!meta || typeof meta !== "object") return "";
  if ("description" in meta && typeof meta.description === "string") return meta.description.trim();
  const seo = (meta as { seo?: unknown }).seo;
  if (seo && typeof seo === "object" && "description" in seo && typeof (seo as { description?: unknown }).description === "string") {
    return String((seo as { description: string }).description).trim();
  }
  return "";
}

function metaSeoTitle(meta: PageScoreInput["meta"], pageTitle: string): string {
  if (!meta || typeof meta !== "object") return pageTitle;
  const seo = (meta as { seo?: unknown }).seo;
  if (seo && typeof seo === "object" && "title" in seo && typeof (seo as { title?: unknown }).title === "string") {
    const t = String((seo as { title: string }).title).trim();
    return t || pageTitle;
  }
  return pageTitle;
}

export function hasEffectiveCta(blocks: Block[]): boolean {
  if (blocks.some((b) => b.type === "cta")) return true;
  return blocks.some((b) => {
    if (b.type === "hero") {
      const f = getBlockEntryFlatForRender(b);
      return Boolean(String(f.ctaLabel ?? "").trim() && String(f.ctaHref ?? "").trim());
    }
    if (b.type === "hero_bleed") {
      const f = getBlockEntryFlatForRender(b);
      const primary =
        Boolean(String(f.ctaPrimary ?? "").trim()) && Boolean(String(f.ctaPrimaryHref ?? "").trim());
      const secondary =
        Boolean(String(f.ctaSecondary ?? "").trim()) && Boolean(String(f.ctaSecondaryHref ?? "").trim());
      return primary || secondary;
    }
    return false;
  });
}

function richTextCharCount(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    if (b.type === "richText") n += String(b.body ?? "").trim().length;
    if (b.type === "hero" || b.type === "hero_bleed") {
      const f = getBlockEntryFlatForRender(b);
      n += String(f.title ?? "").length + String(f.subtitle ?? "").length;
    }
    if (b.type === "cta") {
      const f = getBlockEntryFlatForRender(b);
      n += String(f.title ?? "").length + String(f.body ?? "").length;
    }
  }
  return n;
}

/**
 * Evaluates page quality for SEO/CRO signals. Pure function — safe to memoize.
 */
export function evaluatePage(input: PageScoreInput): PageScore {
  const { title, blocks } = input;
  let score = 50;
  const issues: string[] = [];
  const strengths: string[] = [];

  const t = String(title ?? "").trim();

  if (!t || t.length < 10) {
    issues.push("Tittel er for kort");
    score -= 10;
  } else {
    strengths.push("Tydelig tittel");
    score += 5;
  }

  const seoTitle = metaSeoTitle(input.meta, t);
  if (seoTitle.length >= 50 && seoTitle.length <= 60) {
    strengths.push("SEO-tittel innen anbefalt lengde");
    score += 3;
  } else if (seoTitle.length > 0 && (seoTitle.length < 45 || seoTitle.length > 65)) {
    issues.push("SEO-tittel bør siktes mot ca. 50–60 tegn");
    score -= 5;
  }

  const desc = metaDescription(input.meta);
  if (desc.length >= 120 && desc.length <= 160) {
    strengths.push("Meta-beskrivelse innen typisk SERP-vindu");
    score += 5;
  } else if (desc.length > 0 && desc.length < 80) {
    issues.push("Meta-beskrivelse er kort — utvid for bedre CTR");
    score -= 8;
  } else if (!desc) {
    issues.push("Mangler meta-beskrivelse");
    score -= 10;
  }

  if (blocks.length < 3) {
    issues.push("For lite innhold");
    score -= 10;
  } else {
    strengths.push("Sidestruktur med flere blokker");
    score += 3;
  }

  const chars = richTextCharCount(blocks);
  if (chars < 200) {
    issues.push("Lite tekstinnhold for søk og konvertering");
    score -= 8;
  } else if (chars >= 400) {
    strengths.push("God tekstmengde");
    score += 4;
  }

  if (!hasEffectiveCta(blocks)) {
    issues.push("Mangler tydelig handling (CTA eller knapp i hero)");
    score -= 15;
  } else {
    strengths.push("Handlingsoppfordring synlig");
    score += 5;
  }

  return { score: Math.max(0, Math.min(100, Math.round(score))), issues, strengths };
}
