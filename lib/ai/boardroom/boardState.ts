/**
 * Board-level financial / growth snapshot. Duck-types {@link getBusinessMetrics} without server-only imports.
 */

export type BoardState = {
  revenue: number;
  mrr: number;
  growthRate: number;
  conversion: number;
  churn: number;
  cac: number;
  ltv: number;
  burn: number;
  runway: number;
  experiments: number;
};

function pickNum(input: unknown, key: string): number {
  if (input == null || typeof input !== "object") return 0;
  const v = (input as Record<string, unknown>)[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isMetricsSnapshotLike(input: unknown): input is {
  revenueGrowth: number;
  conversionRate: number;
  churnRate: number;
  runningExperimentsCount: number;
} {
  if (input == null || typeof input !== "object") return false;
  const o = input as Record<string, unknown>;
  return (
    typeof o.revenueGrowth === "number" &&
    typeof o.conversionRate === "number" &&
    typeof o.churnRate === "number" &&
    typeof o.runningExperimentsCount === "number"
  );
}

export function buildBoardState(input: unknown): BoardState {
  if (isMetricsSnapshotLike(input)) {
    return {
      revenue: input.revenueGrowth,
      mrr: 0,
      growthRate: input.revenueGrowth,
      conversion: input.conversionRate,
      churn: input.churnRate,
      cac: 0,
      ltv: 0,
      burn: 0,
      runway: 0,
      experiments: input.runningExperimentsCount,
    };
  }
  return {
    revenue: pickNum(input, "revenue"),
    mrr: pickNum(input, "mrr"),
    growthRate: pickNum(input, "growthRate"),
    conversion: pickNum(input, "conversion"),
    churn: pickNum(input, "churn"),
    cac: pickNum(input, "cac"),
    ltv: pickNum(input, "ltv"),
    burn: pickNum(input, "burn"),
    runway: pickNum(input, "runway"),
    experiments: pickNum(input, "experiments"),
  };
}
