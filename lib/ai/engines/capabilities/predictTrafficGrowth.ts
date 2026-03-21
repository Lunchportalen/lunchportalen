/**
 * AI traffic growth model capability: predictTrafficGrowth.
 * Predicts traffic growth from historical data: computes trend, period-over-period growth rate,
 * and projects future periods using a simple linear model. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "predictTrafficGrowth";

const predictTrafficGrowthCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Predicts traffic growth from historical data: computes average, trend (up/down/stable), period-over-period growth rate, and projects future periods using a simple linear trend. Returns projections and summary.",
  requiredContext: ["trafficData"],
  inputSchema: {
    type: "object",
    description: "Traffic growth prediction input",
    properties: {
      trafficData: {
        type: "array",
        description: "Historical traffic per period (values or { period, value })",
        items: {
          oneOf: [
            { type: "number" },
            { type: "object", properties: { period: { type: "string" }, value: { type: "number" } } },
          ],
        },
      },
      horizon: { type: "number", description: "Number of future periods to project (default 3)" },
      locale: { type: "string", description: "Locale (nb | en) for summary" },
    },
    required: ["trafficData"],
  },
  outputSchema: {
    type: "object",
    description: "Traffic growth prediction result",
    required: [
      "historicalSummary",
      "growthRate",
      "projections",
      "summary",
    ],
    properties: {
      historicalSummary: {
        type: "object",
        required: ["periodCount", "average", "trend", "lastValue"],
        properties: {
          periodCount: { type: "number" },
          average: { type: "number" },
          trend: { type: "string", description: "up | down | stable" },
          lastValue: { type: "number" },
        },
      },
      growthRate: {
        type: "object",
        required: ["periodOverPeriod", "annualizedEstimate"],
        properties: {
          periodOverPeriod: { type: "number", description: "Average % change period-to-period" },
          annualizedEstimate: { type: "number", description: "Rough annual growth % if trend continues" },
        },
      },
      projections: {
        type: "array",
        items: {
          type: "object",
          required: ["periodIndex", "predicted"],
          properties: {
            periodIndex: { type: "number" },
            predicted: { type: "number" },
          },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is prediction only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(predictTrafficGrowthCapability);

export type TrafficDataPoint = number | { period?: string | null; value?: number | null };

export type PredictTrafficGrowthInput = {
  trafficData: TrafficDataPoint[];
  horizon?: number | null;
  locale?: "nb" | "en" | null;
};

export type PredictTrafficGrowthOutput = {
  historicalSummary: {
    periodCount: number;
    average: number;
    trend: "up" | "down" | "stable";
    lastValue: number;
  };
  growthRate: {
    periodOverPeriod: number;
    annualizedEstimate: number;
  };
  projections: Array<{ periodIndex: number; predicted: number }>;
  summary: string;
};

function toValues(data: TrafficDataPoint[]): number[] {
  return data
    .map((d) => (typeof d === "number" ? d : d && typeof (d as { value?: number }).value === "number" ? (d as { value: number }).value : NaN))
    .filter((n) => !Number.isNaN(n) && n >= 0);
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const indices = values.map((_, i) => i);
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((acc, x, i) => acc + x * values[i], 0);
  const sumX2 = indices.reduce((a, b) => a + b * b, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function averagePeriodOverPeriodGrowth(values: number[]): number {
  if (values.length < 2) return 0;
  const changes: number[] = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1];
    if (prev > 0) changes.push(((values[i] - prev) / prev) * 100);
  }
  if (changes.length === 0) return 0;
  return Math.round((changes.reduce((a, b) => a + b, 0) / changes.length) * 100) / 100;
}

/**
 * Predicts traffic growth from historical data. Deterministic; no external calls.
 */
export function predictTrafficGrowth(input: PredictTrafficGrowthInput): PredictTrafficGrowthOutput {
  const isEn = input.locale === "en";
  const values = toValues(Array.isArray(input.trafficData) ? input.trafficData : []);
  const horizon = typeof input.horizon === "number" && !Number.isNaN(input.horizon) && input.horizon > 0
    ? Math.min(Math.floor(input.horizon), 24)
    : 3;

  const periodCount = values.length;
  const average = periodCount === 0 ? 0 : values.reduce((a, b) => a + b, 0) / periodCount;
  const lastValue = periodCount > 0 ? values[periodCount - 1] : 0;
  const slope = linearSlope(values);

  const trend: "up" | "down" | "stable" =
    periodCount < 2 ? "stable" : slope > average * 0.01 ? "up" : slope < -average * 0.01 ? "down" : "stable";

  const periodOverPeriod = averagePeriodOverPeriodGrowth(values);
  const annualizedEstimate = Math.round(periodOverPeriod * 12 * 100) / 100;

  const projections: Array<{ periodIndex: number; predicted: number }> = [];
  if (periodCount > 0) {
    const intercept = periodCount >= 2 ? average - slope * ((periodCount - 1) / 2) : lastValue;
    for (let i = 0; i < horizon; i++) {
      const periodIndex = periodCount + i;
      const predicted = Math.max(0, Math.round((intercept + slope * periodIndex) * 100) / 100);
      projections.push({ periodIndex, predicted });
    }
  }

  const summary =
    periodCount === 0
      ? isEn
        ? "No valid traffic data; add numeric values to get a growth prediction."
        : "Ingen gyldige trafikktall; legg til numeriske verdier for å få en vekstprediksjon."
      : isEn
        ? `Based on ${periodCount} period(s): trend ${trend}, avg ${Math.round(average)}/period, ~${periodOverPeriod}% period-over-period. ${projections.length} period(s) projected.`
        : `Basert på ${periodCount} periode(r): trend ${trend}, snitt ${Math.round(average)}/periode, ~${periodOverPeriod}% periode-over-periode. ${projections.length} periode(r) projisert.`;

  return {
    historicalSummary: {
      periodCount,
      average: Math.round(average * 100) / 100,
      trend,
      lastValue,
    },
    growthRate: {
      periodOverPeriod,
      annualizedEstimate,
    },
    projections,
    summary,
  };
}

export { predictTrafficGrowthCapability, CAPABILITY_NAME };
