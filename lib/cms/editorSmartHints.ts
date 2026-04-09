/**
 * Heuristic CMS quality signals — explainable, no ML. Complements AI assist; never auto-edits.
 */

import type { Block } from "@/app/(backoffice)/backoffice/content/_components/editorBlockTypes";
import { getBlockEntryFlatForRender, isBlockEntryModelAlias } from "@/lib/cms/blocks/blockEntryContract";

export type BlockQualityLevel = "good" | "warn" | "bad";

export type BlockQuality = {
  score: number;
  level: BlockQualityLevel;
  hints: string[];
  layoutIdeas: string[];
};

/** Exported for AI assist on rich text (send plain text to rewrite API). */
export function stripHtmlForAssist(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function textLen(s: string | undefined): number {
  return String(s ?? "").trim().length;
}

function flatForQuality(block: Block): Record<string, unknown> {
  return isBlockEntryModelAlias(block.type) ? getBlockEntryFlatForRender(block) : (block as Record<string, unknown>);
}

/**
 * 0–100 score + hints for the selected block. Deterministic rules only.
 */
export function analyzeBlock(block: Block): BlockQuality {
  const hints: string[] = [];
  const layoutIdeas: string[] = [];
  let score = 72;
  const f = flatForQuality(block);

  if (block.type === "hero" || block.type === "hero_full") {
    const t = textLen(String(f.title ?? ""));
    if (t < 8) {
      hints.push("Overskriften bør være tydeligere (minst noen ord med mening).");
      score -= 22;
    } else if (t < 22) {
      hints.push("Vurder en sterkere overskrift som sier hva besøkende får.");
      score -= 10;
    }
    if (!String(f.imageId ?? "").trim()) {
      hints.push("Legg til hero-bilde for bedre førsteinntrykk.");
      score -= 12;
    }
    if (!String(f.ctaLabel ?? "").trim() || !String(f.ctaHref ?? "").trim()) {
      hints.push("💡 Legg til CTA (tekst + lenke) så besøkende vet neste steg.");
      score -= 18;
    }
    if (block.type === "hero" && t > 0 && t < 28) {
      layoutIdeas.push("Vurder hero_full eller hero_split hvis du vil løfte budskapet visuelt.");
    }
  }

  if (block.type === "hero_bleed") {
    const t = textLen(String(f.title ?? ""));
    if (t < 8) {
      hints.push("Fullskjerms-hero trenger en tydelig tittel.");
      score -= 20;
    }
    if (!String(f.backgroundImageId ?? "").trim()) {
      hints.push("Velg bakgrunnsbilde for helbredt hero.");
      score -= 14;
    }
    if (!String(f.ctaPrimary ?? "").trim()) {
      hints.push("💡 Legg til primær CTA i hero.");
      score -= 12;
    }
  }

  if (block.type === "richText") {
    const body = stripHtmlForAssist(block.body || "");
    const h = textLen(block.heading);
    if (body.length < 20) {
      hints.push("Seksjonen har lite innhold — fyll ut eller fjern blokken.");
      score -= 25;
    }
    if (h > 0 && h < 12) {
      hints.push("Overskriften kan gjøres mer beskrivende.");
      score -= 8;
    }
  }

  if (block.type === "cta") {
    if (!String(f.buttonLabel ?? "").trim() || !String(f.buttonHref ?? "").trim()) {
      hints.push("💡 CTA-blokken trenger knappetekst og lenke.");
      score -= 28;
    }
    if (textLen(String(f.title ?? "")) < 6) {
      hints.push("Gi CTA-en en tydelig tittel.");
      score -= 10;
    }
  }

  if (block.type === "image") {
    if (!String(block.imageId ?? "").trim()) {
      hints.push("Velg et bilde (ID/URL).");
      score -= 30;
    }
    if (!String(block.alt ?? "").trim()) {
      hints.push("Legg til alt-tekst for universell utforming og SEO.");
      score -= 12;
    }
  }

  if (block.type === "banner") {
    if (!String(block.text ?? "").trim()) {
      hints.push("Banneret trenger en kort tekst.");
      score -= 20;
    }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const level: BlockQualityLevel = score >= 78 ? "good" : score >= 52 ? "warn" : "bad";
  return { score, level, hints, layoutIdeas };
}

/** Page-level signals (e.g. last block should often be CTA). */
export function analyzePageBlocks(blocks: Block[]): { hints: string[]; avgScore: number } {
  if (!blocks.length) {
    return { hints: ["Siden har ingen blokker ennå — legg til innhold eller generer med AI."], avgScore: 0 };
  }
  const qualities = blocks.map(analyzeBlock);
  const avgScore = Math.round(qualities.reduce((a, q) => a + q.score, 0) / qualities.length);
  const hints: string[] = [];
  const hasCta = blocks.some((b) => b.type === "cta");
  if (!hasCta) {
    hints.push("💡 Vurder en avsluttende CTA-blokk (konvertering).");
  }
  const last = blocks[blocks.length - 1];
  if (last && last.type !== "cta" && last.type !== "relatedLinks" && blocks.length > 2) {
    hints.push("Mange sider avslutter med CTA eller relaterte lenker — vurder rekkefølgen.");
  }
  return { hints, avgScore };
}
