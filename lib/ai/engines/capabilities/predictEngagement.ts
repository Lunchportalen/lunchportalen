/**
 * AI page engagement model capability: predictEngagement.
 * Predicts engagement (score, scroll depth, click rate) from page features and optional historical metrics.
 * Deterministic; no LLM. Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "predictEngagement";

const predictEngagementCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Predicts page engagement from content and UX features (e.g. word count, CTA, FAQ, readability). Optionally blends with historical scroll depth and click rate. Returns predicted engagement score, scroll depth, click rate, and contributing factors.",
  requiredContext: ["pageFeatures"],
  inputSchema: {
    type: "object",
    description: "Predict engagement input",
    properties: {
      pageFeatures: {
        type: "object",
        description: "Page/content features",
        properties: {
          wordCount: { type: "number", description: "Content word count" },
          hasCta: { type: "boolean", description: "Has clear CTA block" },
          hasFaq: { type: "boolean", description: "Has FAQ or accordion" },
          hasHero: { type: "boolean", description: "Has hero or strong above-fold" },
          readabilityScore: { type: "number", description: "Optional 0-100 readability score" },
          authorityScore: { type: "number", description: "Optional 0-100 content authority score" },
          blockCount: { type: "number", description: "Number of content blocks/sections" },
        },
      },
      historicalScrollDepth: {
        type: "number",
        description: "Optional 0-1; if set, prediction blends with this",
      },
      historicalClickRate: {
        type: "number",
        description: "Optional 0-1; if set, prediction blends with this",
      },
      historicalWeight: {
        type: "number",
        description: "Weight for historical vs model (0-1, default 0.3 when history provided)",
      },
      locale: { type: "string", description: "Locale (nb | en) for factors" },
    },
    required: ["pageFeatures"],
  },
  outputSchema: {
    type: "object",
    description: "Engagement prediction",
    required: ["predictedScore", "predictedScrollDepth", "predictedClickRate", "factors", "summary"],
    properties: {
      predictedScore: { type: "number", description: "Predicted engagement 0-100" },
      predictedScrollDepth: { type: "number", description: "Predicted scroll depth 0-1" },
      predictedClickRate: { type: "number", description: "Predicted click rate 0-1" },
      factors: {
        type: "array",
        items: { type: "object", properties: { name: { type: "string" }, impact: { type: "string" }, contribution: { type: "number" } } },
      },
      confidence: { type: "string", description: "model | blended" },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is prediction only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(predictEngagementCapability);

export type PageFeaturesInput = {
  wordCount?: number | null;
  hasCta?: boolean | null;
  hasFaq?: boolean | null;
  hasHero?: boolean | null;
  readabilityScore?: number | null;
  authorityScore?: number | null;
  blockCount?: number | null;
};

export type PredictEngagementInput = {
  pageFeatures: PageFeaturesInput;
  /** Optional; when set, prediction blends with historical. */
  historicalScrollDepth?: number | null;
  /** Optional; when set, prediction blends with historical. */
  historicalClickRate?: number | null;
  /** 0-1 weight for historical vs model (default 0.3 when history provided). */
  historicalWeight?: number | null;
  locale?: "nb" | "en" | null;
};

export type EngagementFactor = {
  name: string;
  impact: "positive" | "negative" | "neutral";
  contribution: number;
};

export type PredictEngagementOutput = {
  predictedScore: number;
  predictedScrollDepth: number;
  predictedClickRate: number;
  factors: EngagementFactor[];
  confidence: "model" | "blended";
  summary: string;
};

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, typeof v === "number" && !Number.isNaN(v) ? v : 0));
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

/**
 * Predicts engagement from page features; optionally blends with historical scroll depth and click rate.
 * Deterministic heuristic model; no external calls.
 */
export function predictEngagement(input: PredictEngagementInput): PredictEngagementOutput {
  const isEn = input.locale === "en";
  const f = input.pageFeatures ?? {};
  const wordCount = Math.max(0, Math.floor(Number(f.wordCount) ?? 0));
  const hasCta = f.hasCta === true;
  const hasFaq = f.hasFaq === true;
  const hasHero = f.hasHero === true;
  const readabilityScore = clamp100(Number(f.readabilityScore) ?? 50);
  const authorityScore = clamp100(Number(f.authorityScore) ?? 50);
  const blockCount = Math.max(0, Math.floor(Number(f.blockCount) ?? 0));

  const histScroll = input.historicalScrollDepth != null ? clamp01(Number(input.historicalScrollDepth)) : null;
  const histClick = input.historicalClickRate != null ? clamp01(Number(input.historicalClickRate)) : null;
  const hasHistory = histScroll !== null || histClick !== null;
  const histWeight = Math.max(0, Math.min(1, Number(input.historicalWeight) ?? 0.3));

  const factors: EngagementFactor[] = [];

  // Base scroll depth from content length and structure (not too short, not overwhelming)
  let modelScroll = 0.5;
  if (wordCount >= 200 && wordCount <= 1500) {
    modelScroll += 0.15;
    factors.push({
      name: isEn ? "Content length in range" : "Innholdslengde i område",
      impact: "positive",
      contribution: 0.1,
    });
  } else if (wordCount > 2500) {
    modelScroll -= 0.1;
    factors.push({
      name: isEn ? "Very long content" : "Svært langt innhold",
      impact: "negative",
      contribution: -0.05,
    });
  }
  if (hasHero) {
    modelScroll += 0.08;
    factors.push({
      name: isEn ? "Hero / above-fold" : "Hero / over brettet",
      impact: "positive",
      contribution: 0.08,
    });
  }
  if (hasFaq) {
    modelScroll += 0.07;
    factors.push({
      name: isEn ? "FAQ structure" : "FAQ-struktur",
      impact: "positive",
      contribution: 0.07,
    });
  }
  if (blockCount >= 3 && blockCount <= 10) {
    modelScroll += 0.05;
    factors.push({
      name: isEn ? "Structured sections" : "Strukturerte seksjoner",
      impact: "positive",
      contribution: 0.05,
    });
  }
  modelScroll = clamp01(modelScroll);

  // Click rate from CTA and readability/authority
  let modelClick = 0.02;
  if (hasCta) {
    modelClick += 0.03;
    factors.push({
      name: isEn ? "Clear CTA" : "Tydelig CTA",
      impact: "positive",
      contribution: 0.03,
    });
  }
  if (readabilityScore >= 60) {
    modelClick += 0.01;
    factors.push({
      name: isEn ? "Good readability" : "God lesbarhet",
      impact: "positive",
      contribution: 0.01,
    });
  }
  if (authorityScore >= 60) {
    modelClick += 0.01;
    factors.push({
      name: isEn ? "Content authority" : "Innholdsautoritet",
      impact: "positive",
      contribution: 0.01,
    });
  }
  modelClick = clamp01(modelClick);

  let predictedScrollDepth = modelScroll;
  let predictedClickRate = modelClick;
  let confidence: "model" | "blended" = "model";

  if (hasHistory) {
    const w = histWeight;
    if (histScroll !== null) {
      predictedScrollDepth = clamp01((1 - w) * modelScroll + w * histScroll);
    }
    if (histClick !== null) {
      predictedClickRate = clamp01((1 - w) * modelClick + w * histClick);
    }
    confidence = "blended";
    factors.push({
      name: isEn ? "Blended with historical data" : "Blandet med historiske data",
      impact: "neutral",
      contribution: 0,
    });
  }

  const predictedScore = clamp100(
    predictedScrollDepth * 50 + predictedClickRate * 500
  );

  const summary = isEn
    ? `Predicted engagement ${predictedScore}/100 (scroll ~${Math.round(predictedScrollDepth * 100)}%, click ~${Math.round(predictedClickRate * 1000) / 10}%). ${confidence === "blended" ? "Blended with history." : "Model only."}`
    : `Predikert engasjement ${predictedScore}/100 (rulling ~${Math.round(predictedScrollDepth * 100)}%, klikk ~${Math.round(predictedClickRate * 1000) / 10}%). ${confidence === "blended" ? "Blandet med historikk." : "Kun modell."}`;

  return {
    predictedScore,
    predictedScrollDepth,
    predictedClickRate,
    factors,
    confidence,
    summary,
  };
}

export { predictEngagementCapability, CAPABILITY_NAME };
