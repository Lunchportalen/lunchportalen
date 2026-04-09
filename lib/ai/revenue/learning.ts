/**
 * STEP 6 — Learning loop: structured before/after for audits (persist via ai_activity_log).
 */

export type RevenueLearningRecord = {
  id: string;
  pageId: string;
  timestamp: string;
  changeSummary: string;
  targets: string[];
  /** e.g. conversion rate or CTR */
  metricName: "ctr" | "conversion_rate" | "scroll_depth_avg";
  metricBefore: number | null;
  metricAfter: number | null;
  /** Positive = lift */
  deltaPctPoints: number | null;
  reversible: boolean;
  notes?: string;
};

export function computeDeltaPctPoints(before: number | null, after: number | null): number | null {
  if (before == null || after == null) return null;
  return (after - before) * 100;
}

export function buildLearningRecord(input: {
  pageId: string;
  changeSummary: string;
  targets: string[];
  metricName: RevenueLearningRecord["metricName"];
  metricBefore: number | null;
  metricAfter: number | null;
  reversible?: boolean;
  notes?: string;
}): RevenueLearningRecord {
  const ts = new Date().toISOString();
  const id = `revlearn_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const before = input.metricBefore;
  const after = input.metricAfter;
  let deltaPctPoints: number | null = null;
  if (before != null && after != null) {
    deltaPctPoints = (after - before) * 100;
  }
  return {
    id,
    pageId: input.pageId,
    timestamp: ts,
    changeSummary: input.changeSummary,
    targets: input.targets,
    metricName: input.metricName,
    metricBefore: before,
    metricAfter: after,
    deltaPctPoints,
    reversible: input.reversible !== false,
    notes: input.notes,
  };
}
