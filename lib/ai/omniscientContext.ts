/**
 * Full-funnel context for simulation / ranking (no writes). Deterministic normalization.
 */

export type OmniscientState = {
  revenue: number;
  mrr: number;
  conversion: number;
  traffic: number;
  churn: number;
  cac: number;
  ltv: number;
  experiments: number;
  avgOrderValue: number;
  growthRate: number;
  margin: number;
  topPages: string[];
  worstPages: string[];
  channels: string[];
};

function pickNum(input: unknown, key: string): number {
  if (input == null || typeof input !== "object") return 0;
  const v = (input as Record<string, unknown>)[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x ?? "").trim()).filter(Boolean);
}

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

export function buildOmniscientContextSync(input: unknown): OmniscientState {
  if (isBusinessMetricsSnapshotLike(input)) {
    const growth = input.revenueGrowth;
    return {
      revenue: growth,
      mrr: 0,
      conversion: input.conversionRate,
      traffic: input.eventRowsSampled,
      churn: input.churnRate,
      cac: 0,
      ltv: 0,
      experiments: input.runningExperimentsCount,
      avgOrderValue: 0,
      growthRate: growth,
      margin: 0,
      topPages: [],
      worstPages: [],
      channels: [],
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
    avgOrderValue: pickNum(input, "aov"),
    growthRate: pickNum(input, "growth"),
    margin: pickNum(input, "margin"),
    topPages: strList((input as Record<string, unknown>)?.topPages),
    worstPages: strList((input as Record<string, unknown>)?.worstPages),
    channels: strList((input as Record<string, unknown>)?.channels),
  };
}

/** Async entrypoint for callers that `await` context (I/O-free; same as sync). */
export async function buildOmniscientContext(input: unknown): Promise<OmniscientState> {
  return buildOmniscientContextSync(input);
}
