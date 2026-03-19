/**
 * Unified page optimization motor: one engine that evaluates a page for SEO, CRO, and content.
 * Reuses lib/seo and lib/cro; deterministic. No LLM.
 *
 * Gives the editor a single "page understanding" with:
 * - What the page is trying to achieve (goal)
 * - SEO score and suggestions
 * - CRO score and suggestions
 * - How structure, content, and CTA interact (interplay summary)
 *
 * Existing seo-intelligence and CRO editor flows remain unchanged; this layer can be called
 * when the editor wants combined intelligence (e.g. one panel or prioritised actions).
 */

import { computeSeoIntelligence } from "@/lib/seo/intelligence";
import type { SeoIntelligenceResult } from "@/lib/seo/intelligence";
import { analyzePageForCro } from "@/lib/cro/pageAnalysis";
import { computeCroScore } from "@/lib/cro/scoring";
import { buildCroSuggestions } from "@/lib/cro/suggestions";
import type { CroSuggestion } from "@/lib/cro/suggestions";
import type { CroScoreBreakdown } from "@/lib/cro/scoring";

export type PageOptimizationInput = {
  blocks: Array<{ id: string; type: string; data?: Record<string, unknown> }>;
  meta?: Record<string, unknown>;
  pageTitle?: string;
  locale?: "nb" | "en";
  goal?: "lead" | "info" | "signup";
  brand?: string;
};

export type PageOptimizationResult = {
  /** Page intent (lead / info / signup). */
  goal: "lead" | "info" | "signup";
  /** SEO intelligence: score, suggestions, breakdown. Same shape as seo-intelligence API. */
  seo: SeoIntelligenceResult;
  /** CRO: score, suggestions, breakdown. */
  cro: {
    score: number;
    suggestions: CroSuggestion[];
    breakdown: CroScoreBreakdown;
  };
  /** Short deterministic summary of how SEO and CRO interact on this page. */
  interplay: string;
  /** Single-line message for UI (e.g. "SEO 72, CRO 65. 4 SEO and 3 CRO suggestions."). */
  message: string;
  evaluatedAt: string;
};

function buildInterplay(
  seo: SeoIntelligenceResult,
  cro: { score: number; suggestions: CroSuggestion[] },
  locale: "nb" | "en"
): string {
  const parts: string[] = [];
  const isEn = locale === "en";

  const seoHigh = seo.breakdown?.weakCta ?? 0;
  const seoCta = (seo.breakdown?.cta ?? 0) > 0;
  const croCta = cro.suggestions.some((s) => s.type === "missing_cta" || s.type === "weak_cta");
  if (seoCta || seoHigh > 0 || croCta) {
    parts.push(
      isEn
        ? "CTA affects both: a missing or weak CTA lowers both SEO and conversion scores."
        : "CTA påvirker begge: manglende eller svak CTA senker både SEO- og konverteringsscore."
    );
  }

  const seoTitle = (seo.breakdown?.title ?? 0) > 0;
  const seoDesc = (seo.breakdown?.description ?? 0) > 0;
  if (seoTitle || seoDesc) {
    parts.push(
      isEn
        ? "Title and meta description matter for search visibility; improve them to raise SEO."
        : "Tittel og meta-beskrivelse teller for søkesynlighet; forbedre dem for bedre SEO."
    );
  }

  const croHeadline = cro.suggestions.some((s) => s.type === "missing_headline" || s.type === "weak_headline");
  const seoHeading = (seo.breakdown?.heading ?? 0) > 0;
  if (croHeadline || seoHeading) {
    parts.push(
      isEn
        ? "A clear headline helps both: it supports SEO structure and sets conversion context."
        : "En tydelig overskrift hjelper begge: den styrker SEO-struktur og setter konverteringskontekst."
    );
  }

  const contentDepth = (seo.breakdown?.contentDepth ?? 0) > 0;
  const valueProps = cro.suggestions.some((s) => s.type === "missing_value_props");
  if (contentDepth || valueProps) {
    parts.push(
      isEn
        ? "Content depth and value props: enough body text helps SEO; value propositions support conversion."
        : "Innholdsdybde og verdiargumenter: tilstrekkelig brødtekst hjelper SEO; verdiargumenter støtter konvertering."
    );
  }

  if (parts.length === 0) {
    return isEn
      ? "SEO and CRO are aligned: focus on the remaining suggestions in each area."
      : "SEO og CRO henger sammen: fokuser på de gjenværende forslagene i hvert område.";
  }
  return parts.join(" ");
}

/**
 * Evaluate a page holistically: SEO + CRO in one call. Deterministic; reuses existing modules.
 * Use this when the editor needs one "page optimization brain" instead of separate SEO and CRO tools.
 */
export function computePageOptimization(input: PageOptimizationInput): PageOptimizationResult {
  const locale = input.locale === "en" ? "en" : "nb";
  const goal = input.goal === "info" || input.goal === "signup" ? input.goal : "lead";

  const seo = computeSeoIntelligence({
    blocks: input.blocks,
    meta: input.meta,
    pageTitle: input.pageTitle,
    locale,
    goal,
    brand: input.brand,
  });

  const croAnalysis = analyzePageForCro({
    blocks: input.blocks,
    meta: input.meta,
    pageTitle: input.pageTitle,
  });
  const croScoreResult = computeCroScore({ analysis: croAnalysis });
  const { suggestions: croSuggestions } = buildCroSuggestions(croAnalysis, { locale });

  const interplay = buildInterplay(seo, { score: croScoreResult.score, suggestions: croSuggestions }, locale);

  const isEn = locale === "en";
  const message = isEn
    ? `SEO ${seo.score}, CRO ${croScoreResult.score}. ${seo.suggestions.length} SEO and ${croSuggestions.length} CRO suggestion(s).`
    : `SEO ${seo.score}, CRO ${croScoreResult.score}. ${seo.suggestions.length} SEO- og ${croSuggestions.length} CRO-forslag.`;

  return {
    goal,
    seo,
    cro: {
      score: croScoreResult.score,
      suggestions: croSuggestions,
      breakdown: croScoreResult.breakdown,
    },
    interplay,
    message,
    evaluatedAt: new Date().toISOString(),
  };
}
