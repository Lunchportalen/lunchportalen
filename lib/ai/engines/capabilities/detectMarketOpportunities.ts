/**
 * Opportunity detection AI capability: detectMarketOpportunities.
 * Detects market opportunities from gaps, trends, strengths, and constraints.
 * Returns prioritized opportunities with fit score, signals, and next steps. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "detectMarketOpportunities";

const detectMarketOpportunitiesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects market opportunities from gaps, trends, strengths, and constraints. Returns prioritized opportunities with type, segment, fit score, supporting signals, and next steps. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Market opportunity detection input",
    properties: {
      marketContext: { type: "string", description: "Industry or region context" },
      gaps: {
        type: "array",
        description: "Identified gaps (unmet need, white space)",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            segment: { type: "string" },
            type: { type: "string", enum: ["product", "channel", "segment", "timing", "experience"] },
          },
        },
      },
      trends: {
        type: "array",
        description: "Relevant trends (name, direction, strength)",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            direction: { type: "string", enum: ["up", "down", "stable"] },
            strength: { type: "string", enum: ["weak", "moderate", "strong"] },
          },
        },
      },
      strengths: {
        type: "array",
        description: "Current capabilities that could support opportunities",
        items: { type: "string" },
      },
      constraints: {
        type: "array",
        description: "Limitations (budget, capacity, regulatory)",
        items: { type: "string" },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Market opportunity detection result",
    required: ["opportunities", "summary", "generatedAt"],
    properties: {
      opportunities: {
        type: "array",
        items: {
          type: "object",
          required: ["id", "title", "description", "type", "priority", "fitScore", "signals", "nextSteps"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["product", "channel", "segment", "timing", "experience"] },
            segment: { type: "string" },
            priority: { type: "string", enum: ["high", "medium", "low"] },
            fitScore: { type: "number", description: "0-100" },
            signals: { type: "array", items: { type: "string" } },
            nextSteps: { type: "array", items: { type: "string" } },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is detection/suggestions only; no market or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectMarketOpportunitiesCapability);

const GAP_TYPES = ["product", "channel", "segment", "timing", "experience"] as const;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type GapInput = {
  description?: string | null;
  segment?: string | null;
  type?: string | null;
};

export type TrendInput = {
  name?: string | null;
  direction?: string | null;
  strength?: string | null;
};

export type DetectMarketOpportunitiesInput = {
  marketContext?: string | null;
  gaps?: GapInput[] | null;
  trends?: TrendInput[] | null;
  strengths?: string[] | null;
  constraints?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type MarketOpportunity = {
  id: string;
  title: string;
  description: string;
  type: string;
  segment: string;
  priority: "high" | "medium" | "low";
  fitScore: number;
  signals: string[];
  nextSteps: string[];
};

export type DetectMarketOpportunitiesOutput = {
  opportunities: MarketOpportunity[];
  summary: string;
  generatedAt: string;
};

/**
 * Detects market opportunities from gaps, trends, strengths, and constraints. Deterministic; no external calls.
 */
export function detectMarketOpportunities(input: DetectMarketOpportunitiesInput): DetectMarketOpportunitiesOutput {
  const isEn = input.locale === "en";
  const context = safeStr(input.marketContext);
  const gaps = Array.isArray(input.gaps) ? input.gaps.filter((g) => g && typeof g === "object") : [];
  const trends = Array.isArray(input.trends) ? input.trends.filter((t) => t && typeof t === "object") : [];
  const strengths = Array.isArray(input.strengths) ? input.strengths.map(safeStr).filter(Boolean) : [];
  const constraints = Array.isArray(input.constraints) ? input.constraints.map(safeStr).filter(Boolean) : [];

  const opportunities: MarketOpportunity[] = [];
  let idSeq = 1;

  for (let i = 0; i < gaps.length; i++) {
    const g = gaps[i];
    const type = g.type && GAP_TYPES.includes(g.type as (typeof GAP_TYPES)[number]) ? g.type : "segment";
    const description = safeStr(g.description) || (isEn ? "Unmet need or white space" : "Udekket behov eller ledig plass");
    const segment = safeStr(g.segment) || (isEn ? "General" : "Generell");

    const signals: string[] = [];
    signals.push(isEn ? `Gap: ${description}` : `Gap: ${description}`);
    if (context) signals.push(isEn ? `Context: ${context}` : `Kontekst: ${context}`);

    const upTrends = trends.filter((t) => safeStr(t.direction) === "up" && (safeStr(t.strength) === "moderate" || safeStr(t.strength) === "strong"));
    for (const t of upTrends) {
      signals.push(isEn ? `Trend: ${safeStr(t.name)} (${t.strength})` : `Trend: ${safeStr(t.name)} (${t.strength})`);
    }

    let fitScore = 50;
    if (strengths.length > 0) fitScore += Math.min(25, strengths.length * 8);
    if (constraints.length > 0) fitScore -= Math.min(25, constraints.length * 8);
    fitScore = Math.max(0, Math.min(100, fitScore));

    const priority = fitScore >= 70 ? "high" : fitScore >= 45 ? "medium" : "low";

    const nextSteps: string[] = [];
    nextSteps.push(isEn ? "Validate demand with segment (e.g. interviews, survey)." : "Valider etterspørsel med segment (f.eks. intervjuer, spørreundersøkelse).");
    if (type === "channel") nextSteps.push(isEn ? "Pilot channel with clear success metrics." : "Pilot kanal med tydelige suksessmål.");
    if (type === "product") nextSteps.push(isEn ? "Define MVP and test with early adopters." : "Definer MVP og test med tidlige brukere.");

    const title = description.length > 60 ? description.slice(0, 57) + "…" : description;

    opportunities.push({
      id: `opp-${idSeq++}`,
      title,
      description,
      type,
      segment,
      priority,
      fitScore,
      signals,
      nextSteps,
    });
  }

  if (opportunities.length === 0 && (trends.length > 0 || context)) {
    const upStrong = trends.filter((t) => safeStr(t.direction) === "up" && safeStr(t.strength) === "strong");
    if (upStrong.length > 0) {
      const t = upStrong[0];
      opportunities.push({
        id: "opp-1",
        title: isEn ? `Leverage trend: ${safeStr(t.name)}` : `Utnytt trend: ${safeStr(t.name)}`,
        description: isEn ? "Strong upward trend; consider product or channel alignment." : "Sterk oppadgående trend; vurder produkt- eller kanaljustering.",
        type: "timing",
        segment: context || (isEn ? "Market" : "Marked"),
        priority: "medium",
        fitScore: 55,
        signals: [isEn ? `Trend: ${safeStr(t.name)} (strong)` : `Trend: ${safeStr(t.name)} (sterk)`],
        nextSteps: [isEn ? "Assess fit with current offering and capacity." : "Vurder fit med nåværende tilbud og kapasitet."],
      });
    }
  }

  opportunities.sort((a, b) => {
    const pOrder = { high: 0, medium: 1, low: 2 };
    return pOrder[a.priority] - pOrder[b.priority] || b.fitScore - a.fitScore;
  });

  const summary = isEn
    ? `Market opportunities: ${opportunities.length} detected. ${opportunities.filter((o) => o.priority === "high").length} high priority.`
    : `Markedsmuligheter: ${opportunities.length} oppdaget. ${opportunities.filter((o) => o.priority === "high").length} høy prioritet.`;

  return {
    opportunities,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectMarketOpportunitiesCapability, CAPABILITY_NAME };
