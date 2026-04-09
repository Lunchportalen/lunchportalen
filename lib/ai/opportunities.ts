/**
 * Revenue-oriented opportunity detection (CRO > SEO > content).
 * Pure functions — no side effects.
 */

import type { PageSummary } from "@/lib/ai/siteAnalysis";

export type OpportunityKind = "seo" | "cro" | "content";

export type OpportunityIntent = "missing_cta" | "low_score" | "thin_copy";

export type Opportunity = {
  type: OpportunityKind;
  intent: OpportunityIntent;
  /** Higher = more urgent (CRO base ranks above SEO/content) */
  priority: number;
  pageId: string;
  pageTitle: string;
  description: string;
  /** Explainability key for UI */
  because: string;
};

/** Visual tier for control tower */
export type OpportunityImpact = "high" | "medium" | "low";

const BASE: Record<OpportunityKind, number> = { cro: 100, seo: 70, content: 55 };

export function opportunityImpact(priority: number): OpportunityImpact {
  if (priority >= 95) return "high";
  if (priority >= 75) return "medium";
  return "low";
}

export function detectOpportunities(summaries: PageSummary[]): Opportunity[] {
  const opportunities: Opportunity[] = [];

  for (const page of summaries) {
    if (!page.hasCTA) {
      opportunities.push({
        type: "cro",
        intent: "missing_cta",
        priority: BASE.cro + 15,
        pageId: page.id,
        pageTitle: page.title,
        description: "Mangler tydelig CTA",
        because: "Ingen dedikert CTA-blokk eller hero-knapp — ofte raskest omsetningsløft.",
      });
    }

    if (page.score < 60) {
      opportunities.push({
        type: "seo",
        intent: "low_score",
        priority: BASE.seo + Math.max(0, 15 - Math.floor(page.score / 10)),
        pageId: page.id,
        pageTitle: page.title,
        description: "Lav sidekvalitet (SEO/CRO-score)",
        because: `Poengsum ${page.score}/100 — flere signaler under anbefalt nivå.`,
      });
    }

    if (page.wordCount < 120) {
      opportunities.push({
        type: "content",
        intent: "thin_copy",
        priority: BASE.content + 10,
        pageId: page.id,
        pageTitle: page.title,
        description: "Lite tekstinnhold",
        because: `Ca. ${page.wordCount} ord — mer kontekst støtter både SEO og tillit.`,
      });
    }
  }

  return opportunities.sort((a, b) => b.priority - a.priority);
}

export type CrossPageInsight = {
  id: string;
  impact: OpportunityImpact;
  headline: string;
  detail: string;
  affectedPageIds: string[];
};

/**
 * Aggregates patterns across the site (read-only signals).
 */
export function detectCrossPageInsights(summaries: PageSummary[]): CrossPageInsight[] {
  const out: CrossPageInsight[] = [];
  const noCta = summaries.filter((s) => !s.hasCTA).map((s) => s.id);
  if (noCta.length >= 2) {
    out.push({
      id: "pattern-no-cta",
      impact: "high",
      headline: `${noCta.length} sider mangler CTA`,
      detail: "Samlet høy konverteringsrisiko — prioriter handlingsknapper på disse sidene.",
      affectedPageIds: noCta,
    });
  }

  const thin = summaries.filter((s) => s.wordCount < 120).map((s) => s.id);
  if (thin.length >= 3) {
    out.push({
      id: "pattern-thin-content",
      impact: "medium",
      headline: `${thin.length} sider har lite innhold`,
      detail: "Søk og troverdighet forbedres med mer konkret, målgruppe-tilpasset tekst.",
      affectedPageIds: thin,
    });
  }

  const lowScore = summaries.filter((s) => s.score < 55).map((s) => s.id);
  if (lowScore.length >= 3) {
    out.push({
      id: "pattern-low-score",
      impact: "medium",
      headline: `${lowScore.length} sider scorer under 55`,
      detail: "Vurder struktur, meta-felt og CTA som helhet — samme mønster på tvers av URL-er.",
      affectedPageIds: lowScore,
    });
  }

  const typeHistogram = new Map<string, number>();
  for (const s of summaries) {
    const key = s.title.trim().toLowerCase().slice(0, 48);
    if (!key) continue;
    typeHistogram.set(key, (typeHistogram.get(key) ?? 0) + 1);
  }
  const dupTitles = [...typeHistogram.entries()].filter(([, n]) => n >= 3).map(([t]) => t);
  if (dupTitles.length > 0) {
    out.push({
      id: "pattern-duplicate-titles",
      impact: "low",
      headline: "Like eller svært like sidetitler",
      detail: "Kan skape forvirring i CMS og søk — skill titler og hensikt tydelig.",
      affectedPageIds: summaries.filter((s) => dupTitles.includes(s.title.trim().toLowerCase().slice(0, 48))).map((s) => s.id),
    });
  }

  return out;
}
