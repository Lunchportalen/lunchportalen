import type { MetricsSnapshot } from "./metricsEngine";

export function detectAnomalies(metrics: MetricsSnapshot): string[] {
  const anomalies: string[] = [];
  if (metrics.conversion < 0.01) {
    anomalies.push("CRITICAL_LOW_CONVERSION");
  }
  if (metrics.churn > 0.1) {
    anomalies.push("CRITICAL_HIGH_CHURN");
  }
  if (metrics.revenue < 0) {
    anomalies.push("NEGATIVE_REVENUE");
  }
  if (metrics.traffic > 1000 && metrics.conversion < 0.01) {
    anomalies.push("TRAFFIC_NOT_CONVERTING");
  }
  return anomalies;
}
