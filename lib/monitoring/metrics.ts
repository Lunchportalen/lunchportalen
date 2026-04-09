import "server-only";

import type { GraphMetricsPayload } from "@/lib/observability/graphMetrics";

import type { MonitoringCurrent } from "./types";

/**
 * Aggregates graph observability payload into scalar series comparable to stored snapshots.
 */
export function aggregateCurrentMetrics(payload: GraphMetricsPayload): MonitoringCurrent {
  let totalErrors = 0;
  let latencySum = 0;
  let latencyCount = 0;
  for (const v of Object.values(payload.api)) {
    totalErrors += v.errors;
    if (v.latency != null && Number.isFinite(v.latency)) {
      latencySum += v.latency;
      latencyCount += 1;
    }
  }
  const latency = latencyCount > 0 ? latencySum / latencyCount : null;
  const revenue = payload.revenue.orders?.revenue ?? 0;
  const leadPipelineRecentWrites = payload.db.lead_pipeline?.recentWrites ?? 0;

  return {
    errors: totalErrors,
    latency,
    revenue,
    leadPipelineRecentWrites,
  };
}
