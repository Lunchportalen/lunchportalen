/**
 * Canonical SaaS-shaped state for autonomous loop. Pure normalization; optional page count merged in cron.
 */

export type SaasState = {
  revenue: number;
  mrr: number;
  traffic: number;
  conversion: number;
  churn: number;
  users: number;
  activeUsers: number;
  experiments: number;
  pages: number;
  growthRate: number;
};

function pickNum(input: unknown, key: string): number {
  if (input == null || typeof input !== "object") return 0;
  const v = (input as Record<string, unknown>)[key];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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

/**
 * Builds state from loose input or from {@link getBusinessMetrics} snapshot.
 * `pages` defaults to 0 unless caller merges a DB count; `users`/`activeUsers` are derived deterministically from traffic + conversion when not supplied.
 */
export function buildSaasState(input: unknown): SaasState {
  if (isBusinessMetricsSnapshotLike(input)) {
    const traffic = Math.max(input.eventRowsSampled, 0);
    const users = Math.max(traffic, 1);
    const activeUsers = Math.max(0, Math.min(users, Math.round(input.conversionRate * users)));
    return {
      revenue: input.revenueGrowth,
      mrr: 0,
      traffic,
      conversion: input.conversionRate,
      churn: input.churnRate,
      users,
      activeUsers,
      experiments: input.runningExperimentsCount,
      pages: 0,
      growthRate: input.revenueGrowth,
    };
  }

  return {
    revenue: pickNum(input, "revenue"),
    mrr: pickNum(input, "mrr"),
    traffic: pickNum(input, "traffic"),
    conversion: pickNum(input, "conversion"),
    churn: pickNum(input, "churn"),
    users: pickNum(input, "users"),
    activeUsers: pickNum(input, "activeUsers"),
    experiments: pickNum(input, "experiments"),
    pages: pickNum(input, "pages"),
    growthRate: pickNum(input, "growthRate"),
  };
}
