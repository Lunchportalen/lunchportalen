export type MetricsHistoryInput = {
  errors?: number[];
  latency?: number[];
  revenue?: number[];
};

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Rolling baseline from prior snapshots (same window semantics as current sample).
 */
export type BaselineStats = {
  avgErrors: number;
  avgLatency: number;
  avgRevenue: number;
};

export function buildBaseline(metricsHistory: MetricsHistoryInput): BaselineStats {
  return {
    avgErrors: avg(metricsHistory.errors ?? [0]),
    avgLatency: avg(metricsHistory.latency ?? [0]),
    avgRevenue: avg(metricsHistory.revenue ?? [0]),
  };
}
