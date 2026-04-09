import type { BusinessMetricsSnapshot } from "@/lib/ai/businessMetrics";

export type MetricsSnapshotInput = {
  revenue?: number;
  mrr?: number;
  conversion?: number;
  churn?: number;
  traffic?: number;
  experiments?: number;
};

export type MetricsSnapshot = {
  revenue: number;
  mrr: number;
  conversion: number;
  churn: number;
  traffic: number;
  experiments: number;
  timestamp: number;
};

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function buildMetricsSnapshot(input: MetricsSnapshotInput | null | undefined): MetricsSnapshot {
  return {
    revenue: safeNum(input?.revenue ?? 0),
    mrr: safeNum(input?.mrr ?? 0),
    conversion: safeNum(input?.conversion ?? 0),
    churn: safeNum(input?.churn ?? 0),
    traffic: safeNum(input?.traffic ?? 0),
    experiments: safeNum(input?.experiments ?? 0),
    timestamp: Date.now(),
  };
}

/** Maps {@link BusinessMetricsSnapshot} into KPI fields for observability (deterministic proxies). */
export function businessMetricsToSnapshotInput(m: BusinessMetricsSnapshot): MetricsSnapshotInput {
  return {
    revenue: m.revenueGrowth,
    mrr: 0,
    conversion: m.conversionRate,
    churn: m.churnRate,
    traffic: m.eventRowsSampled,
    experiments: m.runningExperimentsCount,
  };
}
