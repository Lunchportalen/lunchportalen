import "server-only";

import { fetchRecentAutonomyLogs } from "@/lib/ai/autonomy/autonomyLog";

export type AutonomyLearningWeights = {
  seo_fix: number;
  content_improve: number;
  experiment: number;
  publish: number;
  bug_fix: number;
};

const BASE: AutonomyLearningWeights = {
  seo_fix: 1,
  content_improve: 1,
  experiment: 1,
  publish: 1,
  bug_fix: 1,
};

/**
 * Deterministic nudge from recent autonomy_outcome rows (explainable, reversible — not persisted).
 */
export async function updateWeights(): Promise<{ weights: AutonomyLearningWeights; sampleSize: number }> {
  const rows = await fetchRecentAutonomyLogs(120);
  const weights: AutonomyLearningWeights = { ...BASE };
  let n = 0;
  for (const row of rows) {
    if (row.entry_type !== "autonomy_outcome") continue;
    const p = row.payload ?? {};
    const result = typeof p.result === "string" ? p.result : "";
    const kind = typeof p.kind === "string" ? p.kind : "";
    if (!result || !(kind in weights)) continue;
    n++;
    const key = kind as keyof AutonomyLearningWeights;
    if (result === "success" || result === "manual_followup") {
      weights[key] = Math.min(1.2, weights[key] + 0.015);
    } else if (result === "failure" || result === "dismissed") {
      weights[key] = Math.max(0.82, weights[key] - 0.015);
    }
  }
  return { weights, sampleSize: n };
}
