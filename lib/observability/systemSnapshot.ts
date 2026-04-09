import "server-only";

import { getBusinessMetrics } from "@/lib/ai/businessMetrics";
import { evaluateSystemHealth } from "./healthEngine";
import { buildMetricsSnapshot, businessMetricsToSnapshotInput } from "./metricsEngine";

export type SystemSnapshotPayload = {
  snapshot: ReturnType<typeof buildMetricsSnapshot>;
  health: ReturnType<typeof evaluateSystemHealth>;
};

export async function getSystemSnapshotPayload(): Promise<SystemSnapshotPayload> {
  const metrics = await getBusinessMetrics();
  const snapshot = buildMetricsSnapshot(businessMetricsToSnapshotInput(metrics));
  const health = evaluateSystemHealth(snapshot);
  return { snapshot, health };
}
