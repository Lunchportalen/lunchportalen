/**
 * Performance regression detector capability: detectPerformanceRegression.
 * Compares current performance metrics to baseline; flags regressions when
 * current exceeds threshold (percent or absolute). Supports lower-is-better
 * (e.g. LCP, TTFB) and higher-is-better (e.g. throughput). Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../capabilityRegistry";
import { registerCapability } from "../capabilityRegistry";

const CAPABILITY_NAME = "detectPerformanceRegression";

const detectPerformanceRegressionCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Performance regression detector: compares current metric values to baseline. Flags regression when change exceeds threshold (percent or absolute). Supports lower-is-better (latency, LCP, FID, CLS) and higher-is-better (throughput, score). Returns per-metric result, severity, and recommendation. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Detect performance regression input",
    properties: {
      metrics: {
        type: "array",
        description: "Metrics to compare: baseline vs current, with optional threshold",
        items: {
          type: "object",
          required: ["metricId", "baselineValue", "currentValue"],
          properties: {
            metricId: { type: "string", description: "e.g. LCP, TTFB, FCP, throughput" },
            metricName: { type: "string", description: "Display name" },
            baselineValue: { type: "number" },
            currentValue: { type: "number" },
            lowerIsBetter: { type: "boolean", description: "true for latency (default), false for throughput" },
            thresholdPercent: { type: "number", description: "Regress if change exceeds this % (default: 10)" },
            thresholdAbsolute: { type: "number", description: "Regress if absolute delta exceeds this" },
            unit: { type: "string", description: "e.g. ms, %" },
          },
        },
      },
      defaultThresholdPercent: {
        type: "number",
        description: "Default threshold % when not set per metric (default: 10)",
      },
      locale: { type: "string", description: "Locale (nb | en) for messages" },
    },
    required: ["metrics"],
  },
  outputSchema: {
    type: "object",
    description: "Performance regression detection result",
    required: ["regressionDetected", "metricResults", "summary", "generatedAt"],
    properties: {
      regressionDetected: { type: "boolean" },
      metricResults: {
        type: "array",
        items: {
          type: "object",
          required: [
            "metricId",
            "baselineValue",
            "currentValue",
            "deltaPercent",
            "regressed",
            "severity",
          ],
          properties: {
            metricId: { type: "string" },
            metricName: { type: "string" },
            baselineValue: { type: "number" },
            currentValue: { type: "number" },
            deltaPercent: { type: "number" },
            deltaAbsolute: { type: "number" },
            regressed: { type: "boolean" },
            severity: { type: "string", enum: ["high", "medium", "low", "none"] },
            recommendation: { type: "string" },
            unit: { type: "string" },
          },
        },
      },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Detection only; does not mutate metrics or system.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectPerformanceRegressionCapability);

export type PerformanceMetricInput = {
  metricId: string;
  metricName?: string | null;
  baselineValue: number;
  currentValue: number;
  lowerIsBetter?: boolean | null;
  thresholdPercent?: number | null;
  thresholdAbsolute?: number | null;
  unit?: string | null;
};

export type DetectPerformanceRegressionInput = {
  metrics: PerformanceMetricInput[];
  defaultThresholdPercent?: number | null;
  locale?: "nb" | "en" | null;
};

export type MetricRegressionResult = {
  metricId: string;
  metricName?: string | null;
  baselineValue: number;
  currentValue: number;
  deltaPercent: number;
  deltaAbsolute: number;
  regressed: boolean;
  severity: "high" | "medium" | "low" | "none";
  recommendation?: string | null;
  unit?: string | null;
};

export type DetectPerformanceRegressionOutput = {
  regressionDetected: boolean;
  metricResults: MetricRegressionResult[];
  summary: string;
  generatedAt: string;
};

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * Determines if a metric has regressed: for lower-is-better, regression when current > baseline + threshold;
 * for higher-is-better, regression when current < baseline - threshold.
 */
function isRegressed(
  baseline: number,
  current: number,
  lowerIsBetter: boolean,
  thresholdPercent: number,
  thresholdAbsolute: number
): boolean {
  if (baseline === 0) return lowerIsBetter ? current > 0 : current < 0;
  const deltaPercent = ((current - baseline) / Math.abs(baseline)) * 100;
  const deltaAbs = Math.abs(current - baseline);
  if (lowerIsBetter) {
    if (current <= baseline) return false;
    if (thresholdAbsolute > 0 && deltaAbs >= thresholdAbsolute) return true;
    return deltaPercent >= thresholdPercent;
  }
  if (current >= baseline) return false;
  if (thresholdAbsolute > 0 && deltaAbs >= thresholdAbsolute) return true;
  return -deltaPercent >= thresholdPercent;
}

function severityFromRegression(
  deltaPercent: number,
  lowerIsBetter: boolean,
  regressed: boolean
): "high" | "medium" | "low" | "none" {
  if (!regressed) return "none";
  const absPct = Math.abs(deltaPercent);
  if (absPct >= 50) return "high";
  if (absPct >= 20) return "medium";
  return "low";
}

function recommendation(
  metricId: string,
  regressed: boolean,
  lowerIsBetter: boolean,
  deltaPercent: number,
  isEn: boolean
): string {
  if (!regressed) return isEn ? "No action needed." : "Ingen tiltak nødvendig.";
  const name = metricId.toUpperCase();
  if (lowerIsBetter && deltaPercent > 0) {
    if (name.includes("LCP") || name.includes("FCP"))
      return isEn ? "Review image/font loading and render-blocking resources." : "Gå gjennom bilde/font-lasting og blokkerende ressurser.";
    if (name.includes("TTFB"))
      return isEn ? "Check server response time and caching." : "Sjekk svar tid og caching på server.";
    if (name.includes("CLS"))
      return isEn ? "Reserve space for images/embeds; avoid injecting content above existing." : "Reserver plass for bilder/embed; unngå innhold over eksisterende.";
  }
  if (!lowerIsBetter && deltaPercent < 0)
    return isEn ? "Investigate throughput bottlenecks and resource limits." : "Undersøk flaskehalser og ressursgrenser.";
  return isEn ? "Compare with baseline period and recent deployments." : "Sammenlign med baseline-periode og nylige utrulling er.";
}

/**
 * Detects performance regressions by comparing current values to baseline. Deterministic; no external calls.
 */
export function detectPerformanceRegression(
  input: DetectPerformanceRegressionInput
): DetectPerformanceRegressionOutput {
  const metrics = Array.isArray(input.metrics) ? input.metrics : [];
  const defaultThreshold = Math.max(0, Math.min(100, Number(input.defaultThresholdPercent) || 10));
  const isEn = input.locale === "en";

  const metricResults: MetricRegressionResult[] = [];
  let regressionDetected = false;

  for (const m of metrics) {
    const metricId = safeStr(m.metricId) || "metric";
    const baseline = Number(m.baselineValue);
    const current = Number(m.currentValue);
    const lowerIsBetter = m.lowerIsBetter !== false;
    const thresholdPercent = Math.max(0, Math.min(100, Number(m.thresholdPercent) ?? defaultThreshold));
    const thresholdAbsolute = Math.max(0, Number(m.thresholdAbsolute) || 0);

    const deltaAbsolute = current - baseline;
    const deltaPercent =
      baseline === 0 ? (current === 0 ? 0 : (current > 0 ? 100 : -100)) : (deltaAbsolute / Math.abs(baseline)) * 100;

    const regressed = isRegressed(
      baseline,
      current,
      lowerIsBetter,
      thresholdPercent,
      thresholdAbsolute
    );
    if (regressed) regressionDetected = true;

    const severity = severityFromRegression(deltaPercent, lowerIsBetter, regressed);
    const recommendationText = recommendation(metricId, regressed, lowerIsBetter, deltaPercent, isEn);

    metricResults.push({
      metricId,
      metricName: m.metricName ?? undefined,
      baselineValue: baseline,
      currentValue: current,
      deltaPercent,
      deltaAbsolute,
      regressed,
      severity,
      recommendation: recommendationText,
      unit: m.unit ?? undefined,
    });
  }

  metricResults.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2, none: 3 };
    return order[a.severity] - order[b.severity];
  });

  const regressedCount = metricResults.filter((r) => r.regressed).length;
  const summary = isEn
    ? regressionDetected
      ? `Performance regression detected on ${regressedCount} of ${metricResults.length} metric(s).`
      : `No performance regression on ${metricResults.length} metric(s).`
    : regressionDetected
      ? `Ytelsesregresjon oppdaget på ${regressedCount} av ${metricResults.length} metrikk(er).`
      : `Ingen ytelsesregresjon på ${metricResults.length} metrikk(er).`;

  return {
    regressionDetected,
    metricResults,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectPerformanceRegressionCapability, CAPABILITY_NAME };
