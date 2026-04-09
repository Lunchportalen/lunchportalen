import "server-only";

import type { BusinessMetricsSnapshot } from "@/lib/ai/businessMetrics";

/**
 * Normalized observe-phase snapshot for blackbox loop (deterministic fields only).
 */
export type GlobalSystemState = {
  traffic: number;
  conversion: number;
  revenue: number;
  churn: number;
  experiments: number;
  health: string;
};

export function buildSystemState(input: {
  metrics: BusinessMetricsSnapshot;
  health?: string;
}): GlobalSystemState {
  const m = input.metrics;
  return {
    traffic: typeof m.eventRowsSampled === "number" && Number.isFinite(m.eventRowsSampled) ? m.eventRowsSampled : 0,
    conversion:
      typeof m.conversionRate === "number" && Number.isFinite(m.conversionRate) ? m.conversionRate : 0,
    revenue: typeof m.revenueGrowth === "number" && Number.isFinite(m.revenueGrowth) ? m.revenueGrowth : 0,
    churn: typeof m.churnRate === "number" && Number.isFinite(m.churnRate) ? m.churnRate : 0,
    experiments:
      typeof m.runningExperimentsCount === "number" && Number.isFinite(m.runningExperimentsCount)
        ? m.runningExperimentsCount
        : 0,
    health: typeof input.health === "string" && input.health.trim() ? input.health.trim() : "ok",
  };
}
