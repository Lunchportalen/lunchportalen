/**
 * AI drift detection capability: detectModelDrift.
 * Detects model drift by comparing recent metric scores to a baseline: mean shift and variance shift.
 * Use for monitoring AI quality, accuracy, or confidence over time. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectModelDrift";

const detectModelDriftCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects model drift by comparing recent scores (e.g. accuracy, quality, confidence) to a baseline. Reports mean shift and variance shift; flags when recent distribution deviates beyond threshold. Use for AI monitoring and retrain triggers.",
  requiredContext: ["baselineScores", "recentScores"],
  inputSchema: {
    type: "object",
    description: "Model drift detection input",
    properties: {
      baselineScores: {
        type: "array",
        description: "Reference period scores (numbers)",
        items: { type: "number" },
      },
      recentScores: {
        type: "array",
        description: "Recent period scores to compare",
        items: { type: "number" },
      },
      meanShiftThreshold: {
        type: "number",
        description: "Number of baseline std devs for mean drift (default 2)",
      },
      varianceRatioThreshold: {
        type: "number",
        description: "Ratio for variance drift: recentStd/baselineStd outside [1/ratio, ratio] (default 2)",
      },
      higherIsBetter: {
        type: "boolean",
        description: "If true, mean_decreased => worse; if false, mean_increased => worse (default true)",
      },
      locale: { type: "string", description: "Locale (nb | en) for summary" },
    },
    required: ["baselineScores", "recentScores"],
  },
  outputSchema: {
    type: "object",
    description: "Drift detection result",
    required: ["drifted", "meanDrift", "varianceDrift", "direction", "baselineStats", "recentStats", "summary"],
    properties: {
      drifted: { type: "boolean" },
      meanDrift: { type: "boolean" },
      varianceDrift: { type: "boolean" },
      direction: {
        type: "string",
        description: "mean_increased | mean_decreased | unchanged",
      },
      baselineStats: {
        type: "object",
        required: ["mean", "stdDev", "count"],
        properties: {
          mean: { type: "number" },
          stdDev: { type: "number" },
          count: { type: "number" },
        },
      },
      recentStats: {
        type: "object",
        required: ["mean", "stdDev", "count"],
        properties: {
          mean: { type: "number" },
          stdDev: { type: "number" },
          count: { type: "number" },
        },
      },
      summary: { type: "string" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is detection only; no content or system mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api", "editor"],
};

registerCapability(detectModelDriftCapability);

export type DetectModelDriftInput = {
  baselineScores: number[];
  recentScores: number[];
  meanShiftThreshold?: number | null;
  varianceRatioThreshold?: number | null;
  higherIsBetter?: boolean | null;
  locale?: "nb" | "en" | null;
};

export type DriftStats = {
  mean: number;
  stdDev: number;
  count: number;
};

export type DetectModelDriftOutput = {
  drifted: boolean;
  meanDrift: boolean;
  varianceDrift: boolean;
  direction: "mean_increased" | "mean_decreased" | "unchanged";
  baselineStats: DriftStats;
  recentStats: DriftStats;
  summary: string;
};

function toSamples(arr: unknown[]): number[] {
  return arr
    .filter((x): x is number => typeof x === "number" && !Number.isNaN(x))
    .filter((x) => Number.isFinite(x));
}

function stats(samples: number[]): DriftStats {
  const n = samples.length;
  if (n === 0) return { mean: 0, stdDev: 0, count: 0 };
  const mean = samples.reduce((a, b) => a + b, 0) / n;
  const variance =
    n < 2 ? 0 : samples.reduce((acc, x) => acc + (x - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  return {
    mean: Math.round(mean * 1e6) / 1e6,
    stdDev: Math.round(stdDev * 1e6) / 1e6,
    count: n,
  };
}

/**
 * Detects model drift between baseline and recent scores. Deterministic; no external calls.
 */
export function detectModelDrift(input: DetectModelDriftInput): DetectModelDriftOutput {
  const isEn = input.locale === "en";
  const baselineRaw = Array.isArray(input.baselineScores) ? input.baselineScores : [];
  const recentRaw = Array.isArray(input.recentScores) ? input.recentScores : [];
  const baselineSamples = toSamples(baselineRaw);
  const recentSamples = toSamples(recentRaw);

  const meanThreshold =
    typeof input.meanShiftThreshold === "number" &&
    !Number.isNaN(input.meanShiftThreshold) &&
    input.meanShiftThreshold > 0
      ? input.meanShiftThreshold
      : 2;
  const varianceRatio =
    typeof input.varianceRatioThreshold === "number" &&
    !Number.isNaN(input.varianceRatioThreshold) &&
    input.varianceRatioThreshold >= 1
      ? input.varianceRatioThreshold
      : 2;

  const baselineStats = stats(baselineSamples);
  const recentStats = stats(recentSamples);

  const baselineStd = baselineStats.stdDev > 0 ? baselineStats.stdDev : 1;
  const meanDiff = recentStats.mean - baselineStats.mean;
  const meanDrift =
    baselineStats.count >= 2 &&
    recentStats.count >= 1 &&
    Math.abs(meanDiff) > meanThreshold * baselineStd;

  const varianceDrift =
    baselineStats.count >= 2 &&
    recentStats.count >= 2 &&
    baselineStd > 0 &&
    recentStats.stdDev > 0 &&
    (recentStats.stdDev / baselineStd > varianceRatio ||
      recentStats.stdDev / baselineStd < 1 / varianceRatio);

  const direction: "mean_increased" | "mean_decreased" | "unchanged" =
    !meanDrift ? "unchanged" : meanDiff > 0 ? "mean_increased" : "mean_decreased";

  const drifted = meanDrift || varianceDrift;

  const summary =
    baselineStats.count === 0 || recentStats.count === 0
      ? isEn
        ? "Insufficient data: need baseline and recent scores."
        : "Utilstrekkelig data: trenger baseline- og nylige scorer."
      : isEn
        ? `${drifted ? "Drift detected" : "No drift"}: baseline n=${baselineStats.count} (mean=${baselineStats.mean.toFixed(2)}), recent n=${recentStats.count} (mean=${recentStats.mean.toFixed(2)}). ${meanDrift ? "Mean shift." : ""} ${varianceDrift ? "Variance shift." : ""}`
        : `${drifted ? "Drift detektert" : "Ingen drift"}: baseline n=${baselineStats.count} (snitt=${baselineStats.mean.toFixed(2)}), nylig n=${recentStats.count} (snitt=${recentStats.mean.toFixed(2)}). ${meanDrift ? "Snittforskyvning." : ""} ${varianceDrift ? "Variansforskyvning." : ""}`;

  return {
    drifted,
    meanDrift: meanDrift ?? false,
    varianceDrift: varianceDrift ?? false,
    direction,
    baselineStats,
    recentStats,
    summary,
  };
}

export { detectModelDriftCapability, CAPABILITY_NAME };
