/**
 * Normalized business state for growth / “god mode” reasoning. Pure, deterministic.
 */

export type BusinessState = {
  revenue: number;
  mrr: number;
  conversion: number;
  traffic: number;
  churn: number;
  cac: number;
  ltv: number;
  experiments: number;
};

function pickNum(input: unknown, key: string): number {
  if (input == null || typeof input !== "object") return 0;
  const v = (input as Record<string, unknown>)[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Shape returned by {@link getBusinessMetrics} (duck-typed to avoid server-only imports). */
function isBusinessMetricsSnapshotLike(input: unknown): input is {
  revenueGrowth: number;
  conversionRate: number;
  churnRate: number;
  eventRowsSampled: number;
  runningExperimentsCount: number;
} {
  if (input == null || typeof input !== "object") return false;
  const o = input as Record<string, unknown>;
  return (
    typeof o.conversionRate === "number" &&
    typeof o.revenueGrowth === "number" &&
    typeof o.churnRate === "number" &&
    typeof o.eventRowsSampled === "number" &&
    typeof o.runningExperimentsCount === "number"
  );
}

/**
 * Builds a canonical state from loose input or from a {@link getBusinessMetrics} snapshot.
 */
export function buildBusinessState(input: unknown): BusinessState {
  if (isBusinessMetricsSnapshotLike(input)) {
    return {
      revenue: input.revenueGrowth,
      mrr: 0,
      conversion: input.conversionRate,
      traffic: input.eventRowsSampled,
      churn: input.churnRate,
      cac: 0,
      ltv: 0,
      experiments: input.runningExperimentsCount,
    };
  }
  return {
    revenue: pickNum(input, "revenue"),
    mrr: pickNum(input, "mrr"),
    conversion: pickNum(input, "conversion"),
    traffic: pickNum(input, "traffic"),
    churn: pickNum(input, "churn"),
    cac: pickNum(input, "cac"),
    ltv: pickNum(input, "ltv"),
    experiments: pickNum(input, "experiments"),
  };
}
