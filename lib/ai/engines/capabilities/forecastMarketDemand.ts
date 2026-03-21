/**
 * Demand forecasting AI capability: forecastMarketDemand.
 * Produces a simple demand forecast from historical series (linear or moving-average extrapolation).
 * Deterministic; no LLM. Output for planning and capacity.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "forecastMarketDemand";

const forecastMarketDemandCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Forecasts market demand from historical time series. Returns forecasted values for a chosen horizon using linear or moving-average extrapolation. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Demand forecast input",
    properties: {
      series: {
        type: "object",
        description: "Historical demand series",
        properties: {
          metricName: { type: "string", description: "e.g. orders, revenue, volume" },
          unit: { type: "string", description: "e.g. count, EUR, NOK" },
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
      forecastHorizon: { type: "number", description: "Number of periods to forecast (default 4)" },
      method: { type: "string", enum: ["linear", "moving_average"], description: "Extrapolation method" },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["series"],
  },
  outputSchema: {
    type: "object",
    description: "Demand forecast result",
    required: ["forecast", "trend", "methodUsed", "summary", "generatedAt"],
    properties: {
      forecast: {
        type: "array",
        items: {
          type: "object",
          required: ["period", "value", "method"],
          properties: {
            period: { type: "string" },
            value: { type: "number" },
            method: { type: "string" },
          },
        },
      },
      trend: {
        type: "object",
        properties: {
          direction: { type: "string", enum: ["up", "down", "stable"] },
          slopePerPeriod: { type: "number" },
          description: { type: "string" },
        },
      },
      methodUsed: { type: "string" },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is forecast only; no data or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(forecastMarketDemandCapability);

function safeNum(v: unknown): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Linear regression slope (per index). */
function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  let sumX = 0,
    sumY = 0,
    sumXY = 0,
    sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export type DataPointInput = {
  period?: string | null;
  value?: number | null;
};

export type DemandSeriesInput = {
  metricName?: string | null;
  unit?: string | null;
  dataPoints?: DataPointInput[] | null;
};

export type ForecastMarketDemandInput = {
  series: DemandSeriesInput;
  forecastHorizon?: number | null;
  method?: "linear" | "moving_average" | null;
  locale?: "nb" | "en" | null;
};

export type ForecastPoint = {
  period: string;
  value: number;
  method: string;
};

export type ForecastMarketDemandOutput = {
  forecast: ForecastPoint[];
  trend: { direction: "up" | "down" | "stable"; slopePerPeriod: number; description: string };
  methodUsed: string;
  summary: string;
  generatedAt: string;
};

/**
 * Forecasts demand from historical series. Deterministic; no external calls.
 */
export function forecastMarketDemand(input: ForecastMarketDemandInput): ForecastMarketDemandOutput {
  const isEn = input.locale === "en";
  const s = input.series && typeof input.series === "object" ? input.series : {};
  const dataPoints = Array.isArray(s.dataPoints) ? s.dataPoints : [];
  const values = dataPoints.map((p) => safeNum(p.value));
  const periods = dataPoints.map((p) => safeStr(p.period));
  const horizon = typeof input.forecastHorizon === "number" && input.forecastHorizon > 0 ? Math.min(input.forecastHorizon, 12) : 4;
  const method = input.method === "moving_average" ? "moving_average" : "linear";

  const forecast: ForecastPoint[] = [];
  let slopePerPeriod = 0;
  let lastValue = 0;

  if (values.length >= 2) {
    if (method === "linear") {
      slopePerPeriod = linearSlope(values);
      lastValue = values[values.length - 1];
      const intercept = mean(values) - slopePerPeriod * (values.length - 1) / 2;
      for (let i = 0; i < horizon; i++) {
        const idx = values.length + i;
        const value = Math.max(0, intercept + slopePerPeriod * idx);
        forecast.push({
          period: periods.length > 0 ? `F${i + 1}` : `F${i + 1}`,
          value: Math.round(value * 100) / 100,
          method: "linear",
        });
      }
    } else {
      const window = Math.min(3, values.length);
      const recent = values.slice(-window);
      lastValue = mean(recent);
      slopePerPeriod = values.length >= 2 ? (values[values.length - 1] - values[values.length - 2]) : 0;
      for (let i = 0; i < horizon; i++) {
        const value = Math.max(0, lastValue + slopePerPeriod * (i + 1));
        forecast.push({
          period: `F${i + 1}`,
          value: Math.round(value * 100) / 100,
          method: "moving_average",
        });
      }
    }
  } else if (values.length === 1) {
    lastValue = values[0];
    for (let i = 0; i < horizon; i++) {
      forecast.push({
        period: `F${i + 1}`,
        value: lastValue,
        method: "flat",
      });
    }
  }

  const direction: "up" | "down" | "stable" = slopePerPeriod > 0.01 ? "up" : slopePerPeriod < -0.01 ? "down" : "stable";
  const trendDescription =
    direction === "up"
      ? (isEn ? "Demand trending up over history; forecast extends growth." : "Etterspørsel trendet oppover; prognose forlenger vekst.")
      : direction === "down"
        ? (isEn ? "Demand trending down; forecast reflects decline." : "Etterspørsel trendet ned; prognose reflekterer nedgang.")
        : (isEn ? "Demand relatively stable; flat or slight drift." : "Etterspørsel relativt stabil; flat eller lett drift.");

  const methodUsed = method === "moving_average" ? "moving_average" : "linear";
  const summary = isEn
    ? `Demand forecast: ${forecast.length} period(s) ahead, ${methodUsed}. Trend: ${direction}. Based on ${values.length} historical point(s).`
    : `Etterspørselsprognose: ${forecast.length} periode(r) frem, ${methodUsed}. Trend: ${direction}. Basert på ${values.length} historiske punkt(er).`;

  return {
    forecast,
    trend: { direction, slopePerPeriod: Math.round(slopePerPeriod * 1000) / 1000, description: trendDescription },
    methodUsed,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { forecastMarketDemandCapability, CAPABILITY_NAME };
