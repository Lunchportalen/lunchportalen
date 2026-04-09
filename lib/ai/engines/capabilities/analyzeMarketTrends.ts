/**
 * Market trend analyzer capability: analyzeMarketTrends.
 * Analyzes market data (time series or segment comparison) and returns trend direction,
 * strength, insights, and recommendations. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "analyzeMarketTrends";

const analyzeMarketTrendsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Analyzes market trends from time series or segment data. Returns trend direction (up, down, stable), strength, change metrics, insights, and recommendations. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Market trend analysis input",
    properties: {
      series: {
        type: "array",
        description: "Time series: metric name and data points (period, value)",
        items: {
          type: "object",
          properties: {
            metricName: { type: "string" },
            dataPoints: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  period: { type: "string", description: "e.g. 2024-01, week-1" },
                  value: { type: "number" },
                },
              },
            },
          },
        },
      },
      segments: {
        type: "array",
        description: "Segment comparison: current vs previous value",
        items: {
          type: "object",
          properties: {
            segmentName: { type: "string" },
            value: { type: "number" },
            previousValue: { type: "number" },
          },
        },
      },
      marketContext: { type: "string", description: "Industry or region context" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
  },
  outputSchema: {
    type: "object",
    description: "Market trend analysis result",
    required: ["trends", "insights", "recommendations", "summary", "generatedAt"],
    properties: {
      trends: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "direction", "strength", "changePercent", "insight"],
          properties: {
            name: { type: "string" },
            direction: { type: "string", enum: ["up", "down", "stable"] },
            strength: { type: "string", enum: ["weak", "moderate", "strong"] },
            changePercent: { type: "number" },
            insight: { type: "string" },
          },
        },
      },
      insights: { type: "array", items: { type: "string" } },
      recommendations: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is analysis only; no market or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(analyzeMarketTrendsCapability);

const WEAK_THRESHOLD = 5;
const STRONG_THRESHOLD = 20;

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function periodOverPeriodChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function directionAndStrength(changePercent: number): { direction: "up" | "down" | "stable"; strength: "weak" | "moderate" | "strong" } {
  const abs = Math.abs(changePercent);
  if (abs < 1) return { direction: "stable", strength: "weak" };
  const direction = changePercent > 0 ? "up" : "down";
  const strength = abs >= STRONG_THRESHOLD ? "strong" : abs >= WEAK_THRESHOLD ? "moderate" : "weak";
  return { direction, strength };
}

export type DataPointInput = {
  period?: string | null;
  value?: number | null;
};

export type SeriesInput = {
  metricName?: string | null;
  dataPoints?: DataPointInput[] | null;
};

export type SegmentInput = {
  segmentName?: string | null;
  value?: number | null;
  previousValue?: number | null;
};

export type AnalyzeMarketTrendsInput = {
  series?: SeriesInput[] | null;
  segments?: SegmentInput[] | null;
  marketContext?: string | null;
  locale?: "nb" | "en" | null;
};

export type TrendItem = {
  name: string;
  direction: "up" | "down" | "stable";
  strength: "weak" | "moderate" | "strong";
  changePercent: number;
  insight: string;
};

export type AnalyzeMarketTrendsOutput = {
  trends: TrendItem[];
  insights: string[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Analyzes market trends from series or segment data. Deterministic; no external calls.
 */
export function analyzeMarketTrends(input: AnalyzeMarketTrendsInput): AnalyzeMarketTrendsOutput {
  const isEn = input.locale === "en";
  const trends: TrendItem[] = [];
  const insights: string[] = [];
  const recommendations: string[] = [];

  if (Array.isArray(input.series)) {
    for (const s of input.series) {
      const name = safeStr(s.metricName) || "metric";
      const points = Array.isArray(s.dataPoints) ? s.dataPoints : [];
      const values = points.map((p) => safeNum(p.value)).filter((_, i, arr) => arr.length > 0 || true);
      if (values.length < 2) continue;

      const first = values[0];
      const last = values[values.length - 1];
      const changePercent = first !== 0 ? ((last - first) / first) * 100 : (last > 0 ? 100 : 0);
      const { direction, strength } = directionAndStrength(changePercent);

      const insight =
        direction === "up"
          ? (isEn ? "Upward trend over period." : "Oppadgående trend i perioden.")
          : direction === "down"
            ? (isEn ? "Downward trend over period." : "Nedadgående trend i perioden.")
            : (isEn ? "Stable; no significant change." : "Stabil; ingen vesentlig endring.");

      trends.push({ name, direction, strength, changePercent: Math.round(changePercent * 100) / 100, insight });
    }
  }

  if (Array.isArray(input.segments)) {
    for (const seg of input.segments) {
      const name = safeStr(seg.segmentName) || "segment";
      const value = safeNum(seg.value);
      const previous = safeNum(seg.previousValue);
      const changePercent = periodOverPeriodChange(value, previous);
      const { direction, strength } = directionAndStrength(changePercent);

      const insight =
        direction === "up"
          ? (isEn ? "Segment up vs previous period." : "Segment opp mot forrige periode.")
          : direction === "down"
            ? (isEn ? "Segment down vs previous period." : "Segment ned mot forrige periode.")
            : (isEn ? "Segment flat vs previous period." : "Segment flatt mot forrige periode.");

      trends.push({ name, direction, strength, changePercent: Math.round(changePercent * 100) / 100, insight });
    }
  }

  const upCount = trends.filter((t) => t.direction === "up").length;
  const downCount = trends.filter((t) => t.direction === "down").length;
  const strongUp = trends.filter((t) => t.direction === "up" && t.strength === "strong").length;
  const strongDown = trends.filter((t) => t.direction === "down" && t.strength === "strong").length;

  if (strongUp > 0) {
    insights.push(isEn ? "One or more metrics show strong growth; consider scaling or reinforcing." : "Én eller flere måltall viser sterk vekst; vurder skalering eller forsterkning.");
  }
  if (strongDown > 0) {
    insights.push(isEn ? "One or more metrics show strong decline; review drivers and response." : "Én eller flere måltall viser sterk nedgang; vurder drivere og tiltak.");
    recommendations.push(isEn ? "Investigate root cause; consider segment-level or product-level actions." : "Undersøk årsak; vurder segment- eller produktnivå-tiltak.");
  }
  if (trends.length > 0 && upCount > downCount) {
    insights.push(isEn ? "More metrics trending up than down overall." : "Flere måltall trendet opp enn ned totalt.");
  }
  if (trends.length > 0 && downCount > upCount) {
    insights.push(isEn ? "More metrics trending down; monitor and plan response." : "Flere måltall trendet ned; overvåk og planlegg respons.");
  }

  if (input.marketContext) {
    recommendations.push(isEn ? "Use market context to interpret trends (seasonality, region, industry)." : "Bruk markedskontekst for å tolke trender (sesong, region, bransje).");
  }

  const summary = isEn
    ? `Market trends: ${trends.length} trend(s) analyzed. ${upCount} up, ${downCount} down. ${insights.length} insight(s), ${recommendations.length} recommendation(s).`
    : `Markedstrender: ${trends.length} trend(er) analysert. ${upCount} opp, ${downCount} ned. ${insights.length} innsikt(er), ${recommendations.length} anbefaling(er).`;

  return {
    trends,
    insights,
    recommendations,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { analyzeMarketTrendsCapability, CAPABILITY_NAME };
