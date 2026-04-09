/**
 * Feature prioritization AI capability: prioritizeFeatures.
 * Prioritizes features by impact, effort, strategic fit, and user demand.
 * Returns ranked list with priority score, criteria breakdown, and rationale. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "prioritizeFeatures";

const prioritizeFeaturesCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Prioritizes features from impact, effort, strategic fit, and user demand (and optional weights). Returns ranked list with priority score, criteria breakdown, and rationale. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Feature prioritization input",
    properties: {
      features: {
        type: "array",
        description: "Features to prioritize",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            impact: { type: "number", description: "1-10 or 0-1" },
            effort: { type: "number", description: "1-10 or 0-1 (higher = more effort)" },
            strategicFit: { type: "number", description: "1-10 or 0-1" },
            userDemand: { type: "number", description: "1-10 or 0-1" },
            dependencyIds: { type: "array", items: { type: "string" } },
          },
        },
      },
      criteriaWeights: {
        type: "object",
        description: "Optional weights (0-1) for impact, effort, strategicFit, userDemand",
        properties: {
          impact: { type: "number" },
          effort: { type: "number" },
          strategicFit: { type: "number" },
          userDemand: { type: "number" },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["features"],
  },
  outputSchema: {
    type: "object",
    description: "Feature prioritization result",
    required: ["prioritized", "summary", "generatedAt"],
    properties: {
      prioritized: {
        type: "array",
        items: {
          type: "object",
          required: ["rank", "id", "title", "priorityScore", "rationale", "criteriaScores"],
          properties: {
            rank: { type: "number" },
            id: { type: "string" },
            title: { type: "string" },
            priorityScore: { type: "number", description: "0-100" },
            rationale: { type: "string" },
            criteriaScores: {
              type: "object",
              properties: {
                impact: { type: "number" },
                effort: { type: "number" },
                strategicFit: { type: "number" },
                userDemand: { type: "number" },
              },
            },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is prioritization only; no product or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(prioritizeFeaturesCapability);

const DEFAULT_WEIGHTS = { impact: 0.3, effort: -0.25, strategicFit: 0.25, userDemand: 0.2 };

function safeNum(v: unknown, scale10 = true): number {
  if (v == null) return scale10 ? 5 : 0.5;
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return scale10 ? 5 : 0.5;
  if (scale10 && n > 0 && n <= 1) return n * 10;
  return Math.max(0, Math.min(10, n));
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export type FeatureInput = {
  id?: string | null;
  title?: string | null;
  impact?: number | null;
  effort?: number | null;
  strategicFit?: number | null;
  userDemand?: number | null;
  dependencyIds?: string[] | null;
};

export type CriteriaWeightsInput = {
  impact?: number | null;
  effort?: number | null;
  strategicFit?: number | null;
  userDemand?: number | null;
};

export type PrioritizeFeaturesInput = {
  features: FeatureInput[];
  criteriaWeights?: CriteriaWeightsInput | null;
  locale?: "nb" | "en" | null;
};

export type PrioritizedFeature = {
  rank: number;
  id: string;
  title: string;
  priorityScore: number;
  rationale: string;
  criteriaScores: { impact: number; effort: number; strategicFit: number; userDemand: number };
};

export type PrioritizeFeaturesOutput = {
  prioritized: PrioritizedFeature[];
  summary: string;
  generatedAt: string;
};

/**
 * Prioritizes features by weighted score. Deterministic; no external calls.
 */
export function prioritizeFeatures(input: PrioritizeFeaturesInput): PrioritizeFeaturesOutput {
  const isEn = input.locale === "en";
  const cw = input.criteriaWeights && typeof input.criteriaWeights === "object" ? input.criteriaWeights : null;
  const w = {
    impact: cw?.impact != null ? Math.max(0, Math.min(1, Number(cw.impact))) : DEFAULT_WEIGHTS.impact,
    effort: cw?.effort != null ? -Math.abs(Math.max(0, Math.min(1, Number(cw.effort)))) : DEFAULT_WEIGHTS.effort,
    strategicFit: cw?.strategicFit != null ? Math.max(0, Math.min(1, Number(cw.strategicFit))) : DEFAULT_WEIGHTS.strategicFit,
    userDemand: cw?.userDemand != null ? Math.max(0, Math.min(1, Number(cw.userDemand))) : DEFAULT_WEIGHTS.userDemand,
  };

  const raw = Array.isArray(input.features) ? input.features.filter((f) => f && typeof f === "object") : [];
  const scored: { id: string; title: string; impact: number; effort: number; strategicFit: number; userDemand: number; score: number }[] = [];

  for (let i = 0; i < raw.length; i++) {
    const f = raw[i];
    const id = safeStr(f.id) || `feat-${i + 1}`;
    const title = safeStr(f.title) || id;
    const impact = safeNum(f.impact);
    const effort = safeNum(f.effort);
    const strategicFit = safeNum(f.strategicFit);
    const userDemand = safeNum(f.userDemand);

    const norm = (v: number) => v / 10;
    const score = norm(impact) * w.impact + norm(effort) * w.effort + norm(strategicFit) * w.strategicFit + norm(userDemand) * w.userDemand;
    const score0_100 = Math.max(0, Math.min(100, (score + 1) * 50));

    scored.push({ id, title, impact, effort, strategicFit, userDemand, score: score0_100 });
  }

  scored.sort((a, b) => b.score - a.score);

  const prioritized: PrioritizedFeature[] = scored.map((s, idx) => {
    const reasons: string[] = [];
    if (s.impact >= 7) reasons.push(isEn ? "high impact" : "høy effekt");
    if (s.effort <= 4) reasons.push(isEn ? "low effort" : "lav innsats");
    if (s.strategicFit >= 7) reasons.push(isEn ? "strong strategic fit" : "god strategisk fit");
    if (s.userDemand >= 7) reasons.push(isEn ? "high user demand" : "høy brukeretterspørsel");
    const rationale = reasons.length > 0
      ? (isEn ? "Prioritized: " : "Prioritert: ") + reasons.join(", ")
      : (isEn ? "Score-based rank." : "Rangering basert på poengsum.");

    return {
      rank: idx + 1,
      id: s.id,
      title: s.title,
      priorityScore: Math.round(s.score * 100) / 100,
      rationale,
      criteriaScores: { impact: s.impact, effort: s.effort, strategicFit: s.strategicFit, userDemand: s.userDemand },
    };
  });

  const summary = isEn
    ? `Prioritized ${prioritized.length} feature(s). Top: ${prioritized[0]?.title ?? "—"}.`
    : `Prioritert ${prioritized.length} funksjon(er). Topp: ${prioritized[0]?.title ?? "—"}.`;

  return {
    prioritized,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { prioritizeFeaturesCapability, CAPABILITY_NAME };
