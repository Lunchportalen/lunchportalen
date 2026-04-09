import type { MetricsSnapshot } from "./metricsEngine";
import { opsLog } from "@/lib/ops/log";

export function checkAlerts(metrics: MetricsSnapshot): void {
  if (metrics.conversion < 0.01) {
    opsLog("alert_low_conversion", { ...metrics });
  }
  if (metrics.churn > 0.1) {
    opsLog("alert_high_churn", { ...metrics });
  }
}
