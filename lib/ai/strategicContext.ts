/**
 * Long-horizon view for strategy / roadmap (no writes). Deterministic normalization.
 */

export type StrategicContext = {
  revenue: number;
  growthRate: number;
  conversion: number;
  churn: number;
  ltv: number;
  cac: number;
  timeHorizon: "30_days";
  experiments: number;
  opportunities: string[];
  trend: "up" | "down";
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

export function buildStrategicContext(input: unknown): StrategicContext {
  if (isMetricsSnapshotLike(input)) {
    const growthRate = input.revenueGrowth;
    return {
      revenue: growthRate,
      growthRate,
      conversion: input.conversionRate,
      churn: input.churnRate,
      ltv: 0,
      cac: 0,
      timeHorizon: "30_days",
      experiments: input.runningExperimentsCount,
      opportunities: [],
      trend: growthRate > 0 ? "up" : "down",
    };
  }
  const growthRate = pickNum(input, "growthRate");
  return {
    revenue: pickNum(input, "revenue"),
    growthRate,
    conversion: pickNum(input, "conversion"),
    churn: pickNum(input, "churn"),
    ltv: pickNum(input, "ltv"),
    cac: pickNum(input, "cac"),
    timeHorizon: "30_days",
    experiments: pickNum(input, "experiments"),
    opportunities: strList((input as Record<string, unknown>)?.opportunities),
    trend: growthRate > 0 ? "up" : "down",
  };
}
