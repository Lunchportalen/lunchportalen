/**
 * Phase 30: SEO/AEO rules engine – produces optional AIPatchV1 + metaSuggestion.
 * Deterministic: meta title/description suggestions, FAQ richText insert, CTA clarity.
 * Uses page-analysis engine (lib/seo/pageAnalysis) for content signals; ops <= 20.
 */

import type { AIPatchV1 } from "@/lib/cms/model/aiPatch";
import { newBlockId } from "@/lib/cms/model/blockId";
import { analyzePageForSeo } from "@/lib/seo/pageAnalysis";

export type SeoOptimizeInput = {
  locale: string;
  pageTitle?: string;
  pageSlug?: string;
  goal?: "lead" | "info" | "signup";
  audience?: string;
  brand?: string;
  mode?: "safe" | "strict";
};

export type SeoOptimizeContext = {
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  meta?: Record<string, unknown>;
};

export type SeoOptimizeStats = {
  blocksScanned: number;
  changesProposed: number;
  faqAdded: boolean;
  metaSuggested: boolean;
};

const FAQ_HEADING_NB = "Spørsmål og svar";
const FAQ_HEADING_EN = "FAQ";

function findInsertIndex(blocks: SeoOptimizeContext["blocks"]): number {
  const firstRich = blocks.findIndex((b) => b.type === "richText");
  if (firstRich >= 0) return firstRich + 1;
  const firstHero = blocks.findIndex((b) => b.type === "hero");
  if (firstHero >= 0) return firstHero + 1;
  return 0;
}

function faqBody(locale: string): string {
  if (locale === "en") {
    return `Q: What is Lunchportalen?
A: Lunchportalen is a lunch ordering and delivery solution for workplaces.

Q: How does delivery work?
A: Orders are delivered to your office at the agreed time.

Q: Who is this for?
A: HR and office managers who want a simple lunch solution.`;
  }
  return `Q: Hva er Lunchportalen?
A: Lunchportalen er en lunsjordning og leveranseløsning for arbeidsplasser.

Q: Hvordan fungerer leveringen?
A: Bestillinger leveres til kontoret på avtalt tid.

Q: Hvem passer dette for?
A: HR og kontoransvarlige som ønsker en enkel lunsjordning.`;
}

function metaDescriptionTemplate(locale: string, brand: string, goal: string): string {
  if (locale === "en") {
    const g = goal === "signup" ? "sign up" : goal === "info" ? "information" : "leads";
    return `${brand} helps workplaces with lunch ordering and delivery. Get ${g}, request a demo, or contact us for more information.`.slice(0, 160);
  }
  const g = goal === "signup" ? "registrering" : goal === "info" ? "informasjon" : "forespørsler";
  return `${brand} hjelper arbeidsplasser med lunsjbestilling og levering. Få ${g}, be om demo eller ta kontakt.`.slice(0, 160);
}

export function seoOptimizeToSuggestion(args: {
  input: SeoOptimizeInput;
  context: SeoOptimizeContext;
}): {
  summary: string;
  stats: SeoOptimizeStats;
  patch?: AIPatchV1;
  metaSuggestion?: { title?: string; description?: string };
} {
  const { input, context } = args;
  const locale = (input.locale || "nb").toLowerCase().startsWith("en") ? "en" : "nb";
  const brand = (input.brand || "Lunchportalen").trim();
  const goal = input.goal === "info" || input.goal === "signup" ? input.goal : "lead";
  const blocks = context.blocks.slice(0, 100);
  const analysis = analyzePageForSeo({
    blocks: context.blocks,
    meta: context.meta,
    pageTitle: input.pageTitle,
  });
  const metaDesc = analysis.description;
  const pageTitle = (input.pageTitle?.trim() ?? analysis.title) || "";

  const stats: SeoOptimizeStats = {
    blocksScanned: blocks.length,
    changesProposed: 0,
    faqAdded: false,
    metaSuggested: false,
  };

  const ops: AIPatchV1["ops"] = [];
  const metaSuggestion: { title?: string; description?: string } = {};
  const MAX_OPS = 20;

  if (pageTitle && pageTitle.length < 30) {
    metaSuggestion.title = `${pageTitle} | ${brand}`;
    stats.metaSuggested = true;
    stats.changesProposed++;
  }

  const needMetaDesc = !metaDesc || metaDesc.length < 80;
  if (needMetaDesc) {
    metaSuggestion.description = metaDescriptionTemplate(locale, brand, goal);
    stats.metaSuggested = true;
    stats.changesProposed++;
  }

  if (!analysis.hasFaq && ops.length < MAX_OPS) {
    const idx = findInsertIndex(blocks);
    const heading = locale === "en" ? FAQ_HEADING_EN : FAQ_HEADING_NB;
    const id = newBlockId();
    ops.push({
      op: "insertBlock",
      index: idx,
      block: { id, type: "richText", data: { heading, body: faqBody(locale) } },
    });
    stats.faqAdded = true;
    stats.changesProposed++;
  }

  const ctaBlock = blocks.find((b) => b.type === "cta");
  if (ctaBlock && ops.length < MAX_OPS) {
    const data = ctaBlock.data ?? {};
    const buttonLabel = typeof data.buttonLabel === "string" ? data.buttonLabel.trim() : "";
    const title = typeof data.title === "string" ? data.title.trim() : "";
    const needsButton = !buttonLabel || buttonLabel.toLowerCase() === "klikk her" || buttonLabel.toLowerCase() === "click here";
    const needsTitle = !title;
    if (needsButton || needsTitle) {
      const partial: Record<string, unknown> = {};
      if (needsButton) partial.buttonLabel = locale === "en" ? "Request a demo" : "Be om demo";
      if (needsTitle) partial.title = locale === "en" ? "Ready to get started?" : "Klar for å komme i gang?";
      ops.push({ op: "updateBlockData", id: ctaBlock.id, data: partial });
      stats.changesProposed++;
    }
  }

  const patch = ops.length > 0 ? { version: 1 as const, ops } : undefined;
  const hasMeta = !!metaSuggestion.title || !!metaSuggestion.description;
  const summary =
    locale === "en"
      ? `SEO: ${stats.changesProposed} change(s). FAQ: ${stats.faqAdded}. Meta: ${hasMeta}.`
      : `SEO: ${stats.changesProposed} endring(er). FAQ: ${stats.faqAdded}. Meta: ${hasMeta}.`;

  return {
    summary,
    stats,
    ...(patch && { patch }),
    ...(hasMeta && { metaSuggestion }),
  };
}