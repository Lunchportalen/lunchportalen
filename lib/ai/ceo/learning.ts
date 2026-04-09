import "server-only";

import { fetchRecentCeoLogs } from "@/lib/ai/ceo/ceoLog";

export type LearningWeights = {
  seo_fix: number;
  content_improve: number;
  experiment: number;
  publish: number;
};

const BASE: LearningWeights = {
  seo_fix: 1,
  content_improve: 1,
  experiment: 1,
  publish: 1,
};

/**
 * Deterministic weight nudge from recent outcomes (explainable, reversible).
 * Does not persist weights to DB — returned for logging / future use.
 */
export async function updateModel(): Promise<{ weights: LearningWeights; sampleSize: number }> {
  const rows = await fetchRecentCeoLogs(80);
  const weights: LearningWeights = { ...BASE };
  let n = 0;
  for (const row of rows) {
    if (row.entry_type !== "outcome") continue;
    const p = row.payload ?? {};
    const result = typeof p.result === "string" ? p.result : "";
    const dt = typeof p.decisionType === "string" ? p.decisionType : "";
    if (!result || !(dt in weights)) continue;
    n++;
    const key = dt as keyof LearningWeights;
    if (result === "success" || result === "manual_followup") {
      weights[key] = Math.min(1.25, weights[key] + 0.02);
    } else if (result === "failure" || result === "dismissed") {
      weights[key] = Math.max(0.75, weights[key] - 0.02);
    }
  }
  return { weights, sampleSize: n };
}
