import "server-only";

import { getBusinessMetrics } from "@/lib/ai/businessMetrics";

/**
 * Deterministic 0–1 perception proxies from operational metrics (no external psychographic data).
 * High churn → lower trust; higher conversion → lower friction / higher clarity heuristic.
 */
export type PerceptionMetricsSnapshot = {
  clarity: number;
  trust: number;
  differentiation: number;
  consistency: number;
  friction: number;
};

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export async function getPerceptionMetrics(): Promise<PerceptionMetricsSnapshot> {
  const m = await getBusinessMetrics();
  const conv = m.conversionRate;
  const churn = m.churnRate;
  const experiments = m.runningExperimentsCount;

  const clarity = clamp01(0.35 + conv * 25);
  const trust = clamp01(1 - churn * 8);
  const differentiation = clamp01(experiments / 12);
  const consistency = clamp01(0.55 + (1 - churn) * 0.25 + conv * 5);
  const friction = clamp01(0.65 - conv * 20 + churn * 3);

  return { clarity, trust, differentiation, consistency, friction };
}
