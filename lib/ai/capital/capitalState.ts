/**
 * Capital allocation snapshot. Duck-types {@link getBusinessMetrics} without server-only imports.
 */

export type CapitalState = {
  revenue: number;
  mrr: number;
  growth: number;
  conversion: number;
  churn: number;
  cac: number;
  ltv: number;
  traffic: number;
  burn: number;
  runway: number;
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
  eventRowsSampled: number;
} {
  if (input == null || typeof input !== "object") return false;
  const o = input as Record<string, unknown>;
  return (
    typeof o.revenueGrowth === "number" &&
    typeof o.conversionRate === "number" &&
    typeof o.churnRate === "number" &&
    typeof o.eventRowsSampled === "number"
  );
}

export function buildCapitalState(input: unknown): CapitalState {
  if (isMetricsSnapshotLike(input)) {
    return {
      revenue: input.revenueGrowth,
      mrr: 0,
      growth: input.revenueGrowth,
      conversion: input.conversionRate,
      churn: input.churnRate,
      cac: 0,
      ltv: 0,
      traffic: input.eventRowsSampled,
      burn: 0,
      runway: 0,
    };
  }
  return {
    revenue: pickNum(input, "revenue"),
    mrr: pickNum(input, "mrr"),
    growth: pickNum(input, "growth"),
    conversion: pickNum(input, "conversion"),
    churn: pickNum(input, "churn"),
    cac: pickNum(input, "cac"),
    ltv: pickNum(input, "ltv"),
    traffic: pickNum(input, "traffic"),
    burn: pickNum(input, "burn"),
    runway: pickNum(input, "runway"),
  };
}
