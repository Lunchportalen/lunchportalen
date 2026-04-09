import type { MetricsSnapshot } from "./metricsEngine";

export type SystemHealthStatus = "healthy" | "warning" | "critical";

export type SystemHealthEvaluation = {
  score: number;
  status: SystemHealthStatus;
};

export function evaluateSystemHealth(metrics: MetricsSnapshot): SystemHealthEvaluation {
  let score = 100;
  if (metrics.conversion < 0.02) score -= 20;
  if (metrics.churn > 0.05) score -= 20;
  if (metrics.experiments === 0) score -= 10;

  const status: SystemHealthStatus =
    score > 80 ? "healthy" : score > 50 ? "warning" : "critical";

  return { score, status };
}
