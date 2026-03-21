/**
 * Design trend analyzer capability: analyzeDesignTrends.
 * Analyzes current design (samples, tokens) against known trend profiles (calm minimal,
 * bold accent, glassmorphism, flat, enterprise). Returns alignment scores, signals, and suggestions. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "analyzeDesignTrends";

const analyzeDesignTrendsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Design trend analyzer: from current design (style samples, tokens), analyzes alignment with trend profiles (calm minimal, bold accent, glassmorphism, flat, enterprise). Returns per-trend alignment score, signals, and optional suggestion. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Analyze design trends input",
    properties: {
      currentDesign: {
        type: "object",
        description: "Current design to analyze",
        properties: {
          styleSamples: {
            type: "array",
            items: {
              type: "object",
              properties: {
                spacing: { type: "string" },
                borderRadius: { type: "string" },
                color: { type: "string" },
                typography: { type: "string" },
                shadows: { type: "string" },
                blur: { type: "string" },
              },
            },
          },
          tokens: {
            type: "object",
            properties: {
              colors: { type: "array", items: { type: "string" } },
              borderRadius: { type: "array", items: { type: "string" } },
            },
          },
          primaryStyle: { type: "string", description: "Optional self-reported style name" },
        },
      },
      focus: {
        type: "array",
        description: "Focus areas (e.g. conversion, accessibility, brand)",
        items: { type: "string" },
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["currentDesign"],
  },
  outputSchema: {
    type: "object",
    description: "Design trends analysis result",
    required: ["trends", "dominantTrend", "summary", "generatedAt"],
    properties: {
      trends: {
        type: "array",
        items: {
          type: "object",
          required: ["trendId", "name", "alignmentScore", "signals"],
          properties: {
            trendId: { type: "string" },
            name: { type: "string" },
            description: { type: "string" },
            alignmentScore: { type: "number", description: "0-100" },
            signals: { type: "array", items: { type: "string" } },
            suggestion: { type: "string" },
          },
        },
      },
      dominantTrend: { type: "string", description: "trendId with highest alignment" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no design or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "editor", "api"],
};

registerCapability(analyzeDesignTrendsCapability);

export type DesignStyleSample = {
  spacing?: string | null;
  borderRadius?: string | null;
  color?: string | null;
  typography?: string | null;
  shadows?: string | null;
  blur?: string | null;
};

export type CurrentDesignInput = {
  styleSamples?: DesignStyleSample[] | null;
  tokens?: { colors?: string[] | null; borderRadius?: string[] | null } | null;
  primaryStyle?: string | null;
};

export type AnalyzeDesignTrendsInput = {
  currentDesign: CurrentDesignInput;
  focus?: string[] | null;
  locale?: "nb" | "en" | null;
};

export type DesignTrendResult = {
  trendId: string;
  name: string;
  description?: string | null;
  alignmentScore: number;
  signals: string[];
  suggestion?: string | null;
};

export type AnalyzeDesignTrendsOutput = {
  trends: DesignTrendResult[];
  dominantTrend: string;
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function parsePx(s: string | null | undefined): number {
  if (!s) return 0;
  const m = String(s).trim().match(/^([\d.]+)\s*px$/i);
  if (m) return Number(m[1]);
  const rem = String(s).trim().match(/^([\d.]+)\s*rem$/i);
  if (rem) return Number(rem[1]) * 16;
  return 0;
}

type TrendDef = {
  trendId: string;
  nameEn: string;
  nameNb: string;
  descEn: string;
  descNb: string;
  score: (samples: DesignStyleSample[], tokens: CurrentDesignInput["tokens"]) => { score: number; signals: string[] };
  suggestionEn: string;
  suggestionNb: string;
};

const TREND_PROFILES: TrendDef[] = [
  {
    trendId: "calm_minimal",
    nameEn: "Calm minimal",
    nameNb: "Rolig minimal",
    descEn: "White/cream base, single accent, ample spacing, clear hierarchy.",
    descNb: "Hvit/creme-base, én accent, god luft, tydelig hierarki.",
    score: (samples, tokens) => {
      const signals: string[] = [];
      let score = 50;
      const colors = tokens?.colors ?? [];
      const hasSingleAccent = colors.filter((c) => /accent|pink|primary/i.test(safeStr(c))).length <= 1;
      if (hasSingleAccent && colors.length >= 1) {
        score += 15;
        signals.push("single accent");
      }
      const radiusValues = (samples.map((s) => parsePx(s.borderRadius)).filter((n) => n > 0) as number[]).concat(
        (tokens?.borderRadius ?? []).map((r) => parsePx(r))
      );
      const avgRadius = radiusValues.length ? radiusValues.reduce((a, b) => a + b, 0) / radiusValues.length : 0;
      if (avgRadius >= 4 && avgRadius <= 12) {
        score += 10;
        signals.push("moderate radius");
      }
      if (samples.some((s) => safeStr(s.spacing).length > 0)) {
        score += 10;
        signals.push("defined spacing");
      }
      return { score: Math.min(100, score), signals };
    },
    suggestionEn: "Align with AGENTS.md: calm base, one accent, no clutter.",
    suggestionNb: "Juster med AGENTS.md: rolig base, én accent, ingen rot.",
  },
  {
    trendId: "bold_accent",
    nameEn: "Bold accent",
    nameNb: "Kraftig accent",
    descEn: "Strong accent usage for CTAs and focus; high contrast.",
    descNb: "Kraftig accent for CTA og fokus; høy kontrast.",
    score: (samples, tokens) => {
      const signals: string[] = [];
      let score = 40;
      const colorStrs = (tokens?.colors ?? []).concat(samples.map((s) => safeStr(s.color)));
      const hasAccent = colorStrs.some((c) => /accent|pink|#e91e|#d81b|hotpink/i.test(c));
      if (hasAccent) {
        score += 25;
        signals.push("accent present");
      }
      if (colorStrs.length >= 2) {
        score += 10;
        signals.push("multiple tokens");
      }
      return { score: Math.min(100, score), signals };
    },
    suggestionEn: "Reserve accent for one primary action; avoid large accent backgrounds.",
    suggestionNb: "Reserver accent for én primær handling; unngå store accent-bakgrunner.",
  },
  {
    trendId: "glassmorphism",
    nameEn: "Glassmorphism",
    nameNb: "Glassmorfisme",
    descEn: "Frosted glass: blur, semi-transparent surfaces, soft borders.",
    descNb: "Mattskåret glass: blur, halvtransparente flater, myke kanter.",
    score: (samples, tokens) => {
      const signals: string[] = [];
      let score = 30;
      const hasBlur = samples.some((s) => /blur|backdrop/i.test(safeStr(s.blur)));
      const hasRadius = samples.some((s) => parsePx(s.borderRadius) >= 8) || (tokens?.borderRadius ?? []).length > 0;
      if (hasBlur) {
        score += 35;
        signals.push("blur/backdrop");
      }
      if (hasRadius) {
        score += 15;
        signals.push("rounded");
      }
      return { score: Math.min(100, score), signals };
    },
    suggestionEn: "Ensure contrast and focus states remain accessible.",
    suggestionNb: "Sikre at kontrast og fokustilstander forblir tilgjengelige.",
  },
  {
    trendId: "flat",
    nameEn: "Flat",
    nameNb: "Flat",
    descEn: "Flat colors, minimal shadows, clear edges.",
    descNb: "Flate farger, minimale skygger, tydelige kanter.",
    score: (samples, tokens) => {
      const signals: string[] = [];
      let score = 45;
      const hasShadow = samples.some((s) => safeStr(s.shadows).length > 0 && !/none|0\s+0/i.test(safeStr(s.shadows)));
      const lowRadius = (samples.map((s) => parsePx(s.borderRadius)).filter((n) => n > 0) as number[]).length
        ? Math.max(...samples.map((s) => parsePx(s.borderRadius)).filter((n) => n > 0) as number[]) < 8
        : true;
      if (!hasShadow) {
        score += 20;
        signals.push("minimal shadow");
      }
      if (lowRadius) {
        score += 15;
        signals.push("low radius");
      }
      return { score: Math.min(100, score), signals };
    },
    suggestionEn: "Keep touch targets and focus indicators clear.",
    suggestionNb: "Hold touch-mål og fokusindikatorer tydelige.",
  },
  {
    trendId: "enterprise",
    nameEn: "Enterprise",
    nameNb: "Enterprise",
    descEn: "Neutral palette, structured spacing, professional typography.",
    descNb: "Nøytral palett, strukturert spacing, profesjonell typografi.",
    score: (samples, tokens) => {
      const signals: string[] = [];
      let score = 50;
      const colors = tokens?.colors ?? [];
      const hasNeutral = colors.some((c) => /neutral|gray|grey|slate/i.test(safeStr(c)));
      const hasSpacing = (tokens?.borderRadius !== undefined && Array.isArray(tokens?.borderRadius)) || samples.some((s) => safeStr(s.spacing).length > 0);
      if (hasNeutral) {
        score += 20;
        signals.push("neutral palette");
      }
      if (hasSpacing || (tokens?.colors ?? []).length >= 2) {
        score += 15;
        signals.push("structured tokens");
      }
      return { score: Math.min(100, score), signals };
    },
    suggestionEn: "Avensia-level quality: calm, predictable, one primary action per view.",
    suggestionNb: "Avensia-nivå: rolig, forutsigbar, én primær handling per visning.",
  },
];

/**
 * Analyzes current design against trend profiles. Deterministic; no external calls.
 */
export function analyzeDesignTrends(input: AnalyzeDesignTrendsInput): AnalyzeDesignTrendsOutput {
  const current = input.currentDesign && typeof input.currentDesign === "object" ? input.currentDesign : {};
  const isEn = input.locale === "en";

  const samples = Array.isArray(current.styleSamples) ? current.styleSamples : [];
  const tokens = current.tokens && typeof current.tokens === "object" ? current.tokens : null;

  const trends: DesignTrendResult[] = TREND_PROFILES.map((def) => {
    const { score, signals } = def.score(samples, tokens);
    return {
      trendId: def.trendId,
      name: isEn ? def.nameEn : def.nameNb,
      description: isEn ? def.descEn : def.descNb,
      alignmentScore: Math.round(score),
      signals: signals.length > 0 ? signals : (isEn ? ["no strong signals"] : ["ingen sterke signaler"]),
      suggestion: score >= 50 ? (isEn ? def.suggestionEn : def.suggestionNb) : null,
    };
  });

  trends.sort((a, b) => b.alignmentScore - a.alignmentScore);
  const dominantTrend = trends.length > 0 ? trends[0].trendId : "none";

  const summary = isEn
    ? `Design trend analysis: dominant trend "${dominantTrend}" (${trends[0]?.alignmentScore ?? 0}% alignment). ${trends.length} trend(s) evaluated.`
    : `Designtrend-analyse: dominerende trend "${dominantTrend}" (${trends[0]?.alignmentScore ?? 0}% justering). ${trends.length} trend(er) vurdert.`;

  return {
    trends,
    dominantTrend,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { analyzeDesignTrendsCapability, CAPABILITY_NAME };
