/**
 * Organic traffic prediction model capability: predictOrganicTraffic.
 * Predicts organic (SEO) traffic from historical time series: linear trend or
 * growth-rate extrapolation, with optional confidence band. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "predictOrganicTraffic";

const predictOrganicTrafficCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Organic traffic prediction model: predicts organic (SEO) traffic from historical dataPoints (period, value). Uses linear trend or growth-rate method; returns predictions with optional low/high estimate band, trend, and growth rate. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Predict organic traffic input",
    properties: {
      dataPoints: {
        type: "array",
        description: "Historical organic traffic per period: [{ period, value }, ...], time-ordered",
        items: {
          type: "object",
          required: ["period", "value"],
          properties: {
            period: { type: "string" },
            value: { type: "number" },
          },
        },
      },
      horizon: {
        type: "number",
        description: "Number of future periods to predict (default: 4)",
      },
      method: {
        type: "string",
        description: "Prediction method: linear (trend line) or growth_rate",
        enum: ["linear", "growth_rate"],
      },
      includeConfidenceBand: {
        type: "boolean",
        description: "Include lowEstimate/highEstimate from residual variance (default: true)",
      },
      locale: { type: "string", description: "Locale (nb | en) for summary" },
    },
    required: ["dataPoints"],
  },
  outputSchema: {
    type: "object",
    description: "Organic traffic prediction result",
    required: ["predictions", "historicalSummary", "growthRatePercent", "summary", "predictedAt"],
    properties: {
      trafficType: { type: "string", description: "Always 'organic'" },
      predictions: {
        type: "array",
        items: {
          type: "object",
          required: ["periodLabel", "periodIndex", "predictedValue"],
          properties: {
            periodLabel: { type: "string" },
            periodIndex: { type: "number" },
            predictedValue: { type: "number" },
            lowEstimate: { type: "number" },
            highEstimate: { type: "number" },
          },
        },
      },
      historicalSummary: {
        type: "object",
        required: ["periodCount", "average", "trend", "lastValue"],
        properties: {
          periodCount: { type: "number" },
          average: { type: "number" },
          trend: { type: "string", enum: ["up", "down", "stable"] },
          lastValue: { type: "number" },
        },
      },
      growthRatePercent: { type: "number" },
      summary: { type: "string" },
      predictedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is prediction only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(predictOrganicTrafficCapability);

export type OrganicTrafficDataPoint = {
  period: string;
  value: number;
};

export type PredictOrganicTrafficInput = {
  dataPoints: OrganicTrafficDataPoint[];
  horizon?: number | null;
  method?: "linear" | "growth_rate" | null;
  includeConfidenceBand?: boolean | null;
  locale?: "nb" | "en" | null;
};

export type OrganicTrafficPrediction = {
  periodLabel: string;
  periodIndex: number;
  predictedValue: number;
  lowEstimate?: number;
  highEstimate?: number;
};

export type PredictOrganicTrafficOutput = {
  trafficType: "organic";
  predictions: OrganicTrafficPrediction[];
  historicalSummary: {
    periodCount: number;
    average: number;
    trend: "up" | "down" | "stable";
    lastValue: number;
  };
  growthRatePercent: number;
  summary: string;
  predictedAt: string;
};

const DEFAULT_HORIZON = 4;
const CONFIDENCE_STD_MULTIPLIER = 1.5;

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function linearRegression(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  const indices = values.map((_, i) => i);
  const sumX = indices.reduce((a, b) => a + b, 0);
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = indices.reduce((acc, x, i) => acc + x * values[i], 0);
  const sumX2 = indices.reduce((a, b) => a + b * b, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function residualStdDev(values: number[], slope: number, intercept: number): number {
  if (values.length < 3) return 0;
  const residuals = values.map((v, i) => v - (intercept + slope * i));
  const avg = mean(residuals);
  const sq = residuals.map((r) => (r - avg) ** 2);
  return Math.sqrt(sq.reduce((a, b) => a + b, 0) / (values.length - 2));
}

function averageGrowthRatePercent(values: number[]): number {
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
 * Predicts organic traffic from historical data. Deterministic; no external calls.
 */
export function predictOrganicTraffic(input: PredictOrganicTrafficInput): PredictOrganicTrafficOutput {
  const points = Array.isArray(input.dataPoints) ? input.dataPoints : [];
  const values = points.map((p) => (typeof p?.value === "number" ? p.value : Number(p?.value) ?? 0)).filter((v) => v >= 0);
  const horizon = Math.min(24, Math.max(1, Math.floor(Number(input.horizon) ?? DEFAULT_HORIZON)));
  const method = input.method === "growth_rate" ? "growth_rate" : "linear";
  const includeBand = input.includeConfidenceBand !== false;
  const isEn = input.locale === "en";

  const periodCount = values.length;
  const average = periodCount === 0 ? 0 : mean(values);
  const lastValue = periodCount > 0 ? values[periodCount - 1] : 0;
  const growthRatePercent = averageGrowthRatePercent(values);

  const slope = periodCount >= 2 ? linearRegression(values).slope : 0;
  const trend: "up" | "down" | "stable" =
    periodCount < 2 ? "stable" : slope > average * 0.005 ? "up" : slope < -average * 0.005 ? "down" : "stable";

  const predictions: OrganicTrafficPrediction[] = [];

  if (periodCount > 0) {
    const { slope: s, intercept } = linearRegression(values);
    const resStd = includeBand ? residualStdDev(values, s, intercept) : 0;

    for (let i = 0; i < horizon; i++) {
      const periodIndex = periodCount + i;
      const periodLabel = `t+${i + 1}`;
      let predictedValue: number;
      if (method === "growth_rate" && growthRatePercent !== 0) {
        const factor = 1 + growthRatePercent / 100;
        predictedValue = i === 0 ? lastValue * factor : (predictions[i - 1]?.predictedValue ?? lastValue) * factor;
        predictedValue = Math.max(0, Math.round(predictedValue * 100) / 100);
      } else {
        predictedValue = Math.max(0, Math.round((intercept + s * periodIndex) * 100) / 100);
      }
      const halfWidth = resStd * CONFIDENCE_STD_MULTIPLIER * Math.sqrt(1 + (1 / periodCount) + (periodIndex - (periodCount - 1) / 2) ** 2 / ((periodCount * (periodCount + 1)) / 12));
      predictions.push({
        periodLabel,
        periodIndex,
        predictedValue,
        ...(includeBand && resStd > 0
          ? {
              lowEstimate: Math.max(0, Math.round((predictedValue - halfWidth) * 100) / 100),
              highEstimate: Math.round((predictedValue + halfWidth) * 100) / 100,
            }
          : {}),
      });
    }
  }

  const summary =
    periodCount === 0
      ? isEn
        ? "No organic traffic data; add period/value points to get predictions."
        : "Ingen organisk trafikkdata; legg til periode/verdi-punkter for prediksjoner."
      : isEn
        ? `Organic traffic: ${periodCount} period(s), trend ${trend}, ~${growthRatePercent}% period-over-period. ${predictions.length} period(s) predicted.`
        : `Organisk trafikk: ${periodCount} periode(r), trend ${trend}, ~${growthRatePercent}% periode-over-periode. ${predictions.length} periode(r) predikert.`;

  return {
    trafficType: "organic",
    predictions,
    historicalSummary: {
      periodCount,
      average: Math.round(average * 100) / 100,
      trend,
      lastValue,
    },
    growthRatePercent,
    summary,
    predictedAt: new Date().toISOString(),
  };
}

export { predictOrganicTrafficCapability, CAPABILITY_NAME };
