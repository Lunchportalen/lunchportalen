import "server-only";

import { opsLog } from "@/lib/ops/log";

import { computeBaseline } from "./predictiveBaseline";
import type { BaselineStats } from "./predictiveBaseline";
import { classifyAnomaly } from "./predictiveClassifier";
import type { AnomalyLevel } from "./predictiveClassifier";
import { loadMetricHistory } from "./loadMetricHistory";
import { scoreAnomaly } from "./predictiveScoring";
import { storeMetric } from "./storeMetric";

export type PredictiveCheckResult = {
  metric: string;
  value: number;
  baseline: BaselineStats;
  score: number;
  level: AnomalyLevel;
};

function normalFallback(metric: string, value: number): PredictiveCheckResult {
  return {
    metric,
    value,
    baseline: { mean: 0, std: 0 },
    score: 0,
    level: "NORMAL",
  };
}

/**
 * Learns from {@link loadMetricHistory}, scores current value vs baseline, persists observation (best-effort).
 * Never throws; returns NORMAL on any failure.
 */
export async function runPredictiveCheck(metric: string, value: number): Promise<PredictiveCheckResult> {
  const m = String(metric ?? "").trim();
  if (!m || !Number.isFinite(value)) {
    return normalFallback(m || "unknown", Number.isFinite(value) ? value : 0);
  }

  try {
    const history = await loadMetricHistory(m);
    const baseline = computeBaseline(history);
    const score = scoreAnomaly(value, baseline);
    const level = classifyAnomaly(score);
    await storeMetric(m, value);
    return {
      metric: m,
      value,
      baseline,
      score,
      level,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("predictive_check_failed", { metric: m, message });
    try {
      await storeMetric(m, value);
    } catch {
      /* ignore */
    }
    return normalFallback(m, value);
  }
}
