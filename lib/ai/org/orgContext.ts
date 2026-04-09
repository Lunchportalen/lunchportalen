/**
 * Shared org context for CEO + team agents. Deterministic numeric normalization.
 * Duck-types {@link getBusinessMetrics} snapshot without importing server-only modules.
 */

export type OrgContext = {
  revenue: number;
  conversion: number;
  churn: number;
  traffic: number;
  experiments: number;
  timestamp: number;
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
  runningExperimentsCount: number;
} {
  if (input == null || typeof input !== "object") return false;
  const o = input as Record<string, unknown>;
  return (
    typeof o.conversionRate === "number" &&
    typeof o.churnRate === "number" &&
    typeof o.eventRowsSampled === "number" &&
    typeof o.runningExperimentsCount === "number" &&
    typeof o.revenueGrowth === "number"
  );
}

export function buildOrgContext(input: unknown, nowMs: number = Date.now()): OrgContext {
  if (isMetricsSnapshotLike(input)) {
    return {
      revenue: input.revenueGrowth,
      conversion: input.conversionRate,
      churn: input.churnRate,
      traffic: input.eventRowsSampled,
      experiments: input.runningExperimentsCount,
      timestamp: nowMs,
    };
  }
  return {
    revenue: pickNum(input, "revenue"),
    conversion: pickNum(input, "conversion"),
    churn: pickNum(input, "churn"),
    traffic: pickNum(input, "traffic"),
    experiments: pickNum(input, "experiments"),
    timestamp: nowMs,
  };
}
