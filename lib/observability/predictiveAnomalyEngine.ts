import "server-only";

import { detectMLAnomaly } from "@/lib/ml/anomaly";

import type { MetricsSnapshot } from "./metricsEngine";
import type { AnomalyLevel } from "./predictiveClassifier";
import { runPredictiveCheck, type PredictiveCheckResult } from "./predictiveEngine";
import { storeMetric } from "./storeMetric";

/**
 * Runs z-score checks per numeric KPI on the snapshot (excludes `timestamp`).
 * `conversion` uses traffic-conditioned linear ML residual vs z-score (other metrics unchanged).
 */
export async function detectPredictiveAnomalies(metrics: MetricsSnapshot): Promise<PredictiveCheckResult[]> {
  const results: PredictiveCheckResult[] = [];
  for (const [key, raw] of Object.entries(metrics)) {
    if (key === "timestamp") continue;
    const num = Number(raw);
    if (!Number.isFinite(num)) continue;
    try {
      if (key === "conversion") {
        try {
          const traffic = Number(metrics.traffic);
          const ml = await detectMLAnomaly(num, traffic);
          if (ml.anomaly && ml.predicted != null) {
            const err = ml.error;
            const level: AnomalyLevel = err > 0.15 ? "CRITICAL" : err > 0.1 ? "HIGH" : "MEDIUM";
            results.push({
              metric: key,
              value: num,
              baseline: { mean: ml.predicted, std: 0 },
              score: err * 100,
              level,
            });
          }
        } catch {
          /* keep history even if ML path fails */
        }
        try {
          await storeMetric("conversion", num);
        } catch {
          /* ignore */
        }
        continue;
      }

      const result = await runPredictiveCheck(key, num);
      if (result.level !== "NORMAL") {
        results.push(result);
      }
    } catch {
      /* deterministic fallback: skip row */
    }
  }
  return results;
}
