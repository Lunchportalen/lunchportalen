/**
 * Traffic anomaly detector capability: detectTrafficAnomaly.
 * Detects spikes or drops in traffic (or other metrics) from a time series.
 * Uses baseline mean ± threshold (std dev or percent). Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectTrafficAnomaly";

const detectTrafficAnomalyCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Traffic anomaly detector: from a time series of values (e.g. daily views, clicks), detects spikes or drops vs baseline. Returns anomalyDetected, direction (spike | drop), severity, currentValue, baselineValue, deviationPercent, periodAffected, message. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect traffic anomaly input",
    properties: {
      dataPoints: {
        type: "array",
        description: "Time-ordered points: [{ period, value }, ...]. Last point is evaluated; rest form baseline.",
        items: {
          type: "object",
          required: ["period", "value"],
          properties: {
            period: { type: "string", description: "e.g. date or period label" },
            value: { type: "number", description: "Metric value (views, clicks, etc.)" },
          },
        },
      },
      metric: {
        type: "string",
        description: "Metric name for messages (e.g. views, clicks, conversions)",
      },
      thresholdStdDev: {
        type: "number",
        description: "Number of standard deviations to flag anomaly (default: 2)",
      },
      thresholdPercent: {
        type: "number",
        description: "Min percent change from baseline to flag when stddev is 0 (default: 50)",
      },
      locale: { type: "string", description: "Locale (nb | en) for message" },
    },
    required: ["dataPoints"],
  },
  outputSchema: {
    type: "object",
    description: "Traffic anomaly detection result",
    required: [
      "anomalyDetected",
      "direction",
      "severity",
      "currentValue",
      "baselineValue",
      "deviationPercent",
      "periodAffected",
      "message",
      "detectedAt",
    ],
    properties: {
      anomalyDetected: { type: "boolean" },
      direction: { type: "string", enum: ["spike", "drop", null], description: "Set when anomalyDetected" },
      severity: { type: "string", enum: ["low", "medium", "high"] },
      currentValue: { type: "number" },
      baselineValue: { type: "number" },
      deviationPercent: { type: "number" },
      periodAffected: { type: "string" },
      message: { type: "string" },
      recommendation: { type: "string" },
      detectedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Detection only; does not mutate any data.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectTrafficAnomalyCapability);

export type DataPoint = {
  period: string;
  value: number;
};

export type DetectTrafficAnomalyInput = {
  dataPoints: DataPoint[];
  metric?: string | null;
  thresholdStdDev?: number | null;
  thresholdPercent?: number | null;
  locale?: "nb" | "en" | null;
};

export type DetectTrafficAnomalyOutput = {
  anomalyDetected: boolean;
  direction: "spike" | "drop" | null;
  severity: "low" | "medium" | "high";
  currentValue: number;
  baselineValue: number;
  deviationPercent: number;
  periodAffected: string;
  message: string;
  recommendation: string;
  detectedAt: string;
};

const DEFAULT_THRESHOLD_STDDEV = 2;
const DEFAULT_THRESHOLD_PERCENT = 50;
const MIN_BASELINE_POINTS = 2;

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr: number[], m?: number): number {
  if (arr.length < 2) return 0;
  const avg = m ?? mean(arr);
  const sqDiffs = arr.map((v) => (v - avg) ** 2);
  return Math.sqrt(sqDiffs.reduce((a, b) => a + b, 0) / (arr.length - 1));
}

/**
 * Detects traffic anomaly from time series. Last point is current; preceding points form baseline.
 * Deterministic; no external calls.
 */
export function detectTrafficAnomaly(input: DetectTrafficAnomalyInput): DetectTrafficAnomalyOutput {
  const points = Array.isArray(input.dataPoints) ? input.dataPoints : [];
  const metric = (input.metric ?? "views").trim() || "views";
  const thresholdStdDev = Math.max(0.5, Number(input.thresholdStdDev) || DEFAULT_THRESHOLD_STDDEV);
  const thresholdPercent = Math.max(1, Math.min(500, Number(input.thresholdPercent) || DEFAULT_THRESHOLD_PERCENT));
  const isEn = input.locale === "en";

  const values = points.map((p) => (typeof p?.value === "number" ? p.value : 0));
  const periods = points.map((p) => String(p?.period ?? ""));

  if (values.length < MIN_BASELINE_POINTS) {
    const periodAffected = periods[periods.length - 1] ?? "";
    return {
      anomalyDetected: false,
      direction: null,
      severity: "low",
      currentValue: values[values.length - 1] ?? 0,
      baselineValue: 0,
      deviationPercent: 0,
      periodAffected,
      message: isEn
        ? `Not enough data (need at least ${MIN_BASELINE_POINTS} points).`
        : `Ikke nok data (trenger minst ${MIN_BASELINE_POINTS} punkter).`,
      recommendation: isEn ? "Collect more data points." : "Samle flere datapunkter.",
      detectedAt: new Date().toISOString(),
    };
  }

  const currentValue = values[values.length - 1] ?? 0;
  const baselineValues = values.slice(0, -1);
  const baselineValue = mean(baselineValues);
  const sd = stddev(baselineValues, baselineValue);
  const periodAffected = periods[periods.length - 1] ?? "";

  let deviationPercent = 0;
  if (baselineValue > 0) {
    deviationPercent = ((currentValue - baselineValue) / baselineValue) * 100;
  }

  let anomalyDetected = false;
  let direction: "spike" | "drop" | null = null;
  let severity: "low" | "medium" | "high" = "low";

  if (sd > 0) {
    const z = baselineValue === 0 ? 0 : (currentValue - baselineValue) / sd;
    if (z >= thresholdStdDev) {
      anomalyDetected = true;
      direction = "spike";
      severity = z >= thresholdStdDev * 1.5 ? "high" : z >= thresholdStdDev * 1.2 ? "medium" : "low";
    } else if (z <= -thresholdStdDev) {
      anomalyDetected = true;
      direction = "drop";
      severity = z <= -thresholdStdDev * 1.5 ? "high" : z <= -thresholdStdDev * 1.2 ? "medium" : "low";
    }
  } else {
    if (Math.abs(deviationPercent) >= thresholdPercent) {
      anomalyDetected = true;
      direction = deviationPercent > 0 ? "spike" : "drop";
      severity = Math.abs(deviationPercent) >= thresholdPercent * 2 ? "high" : Math.abs(deviationPercent) >= thresholdPercent * 1.5 ? "medium" : "low";
    }
  }

  let message: string;
  let recommendation: string;
  if (!anomalyDetected) {
    message = isEn
      ? `No anomaly: ${metric} for ${periodAffected} within normal range.`
      : `Ingen avvik: ${metric} for ${periodAffected} innenfor normalt område.`;
    recommendation = isEn ? "Continue monitoring." : "Fortsett å overvåke.";
  } else {
    const pctStr = Math.abs(Math.round(deviationPercent)).toString();
    if (direction === "spike") {
      message = isEn
        ? `Spike detected: ${metric} for ${periodAffected} is ${pctStr}% above baseline.`
        : `Spike oppdaget: ${metric} for ${periodAffected} er ${pctStr}% over baseline.`;
      recommendation = isEn ? "Verify traffic source and campaign; rule out bots if needed." : "Verifiser trafikkkilde og kampanje; utelukk botter ved behov.";
    } else {
      message = isEn
        ? `Drop detected: ${metric} for ${periodAffected} is ${pctStr}% below baseline.`
        : `Fall oppdaget: ${metric} for ${periodAffected} er ${pctStr}% under baseline.`;
      recommendation = isEn ? "Check availability, campaigns, and external factors." : "Sjekk tilgjengelighet, kampanjer og eksterne faktorer.";
    }
  }

  return {
    anomalyDetected,
    direction,
    severity,
    currentValue,
    baselineValue,
    deviationPercent,
    periodAffected,
    message,
    recommendation,
    detectedAt: new Date().toISOString(),
  };
}

export { detectTrafficAnomalyCapability, CAPABILITY_NAME };
