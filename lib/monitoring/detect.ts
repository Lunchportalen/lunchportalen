import type { BaselineStats } from "./baseline";
import type { MonitoringAlert, MonitoringCurrent } from "./types";

/**
 * Threshold-based detection vs rolling baseline. Low-noise guards for cold/zero baselines.
 */
export function detectAnomalies(
  current: Pick<MonitoringCurrent, "errors" | "latency" | "revenue"> & { latency: number },
  baseline: BaselineStats,
  opts?: { historyCount: number }
): MonitoringAlert[] {
  const alerts: MonitoringAlert[] = [];
  const historyCount = opts?.historyCount ?? 0;

  if (historyCount < 2) {
    return alerts;
  }

  const lat = current.latency;
  const hasLatencySignal = baseline.avgLatency > 0 && lat > 0;

  // ERROR SPIKE — require meaningful absolute volume when baseline is near zero
  const errorRatio = baseline.avgErrors > 0 ? current.errors / baseline.avgErrors : Infinity;
  const minAbsoluteErrors = 5;
  if (baseline.avgErrors < 0.5) {
    if (current.errors >= minAbsoluteErrors) {
      alerts.push({
        type: "error_spike",
        severity: "high",
        message: "Error spike detected",
        explain: `errors=${current.errors} (baseline avg ≈ ${baseline.avgErrors.toFixed(2)}, lav baseline; terskel absolutt ≥${minAbsoluteErrors})`,
      });
    }
  } else if (current.errors > baseline.avgErrors * 2) {
    alerts.push({
      type: "error_spike",
      severity: "high",
      message: "Error spike detected",
      explain: `errors=${current.errors} > 2× baseline avg (${baseline.avgErrors.toFixed(2)}), ratio≈${errorRatio.toFixed(2)}`,
    });
  } else if (
    baseline.avgErrors >= 1 &&
    current.errors >= baseline.avgErrors * 1.5 &&
    current.errors <= baseline.avgErrors * 2
  ) {
    alerts.push({
      type: "error_spike",
      severity: "low",
      message: "Elevated error rate",
      explain: `errors=${current.errors} mellom 1.5× og 2× baseline (${baseline.avgErrors.toFixed(2)})`,
    });
  }

  // LATENCY SPIKE — only when both sides have signal
  if (hasLatencySignal && lat > baseline.avgLatency * 2) {
    alerts.push({
      type: "latency",
      severity: "medium",
      message: "Latency increased",
      explain: `latency=${lat.toFixed(1)}ms > 2× baseline avg (${baseline.avgLatency.toFixed(1)}ms)`,
    });
  }

  // REVENUE DROP — skip when no revenue baseline
  if (baseline.avgRevenue > 0 && current.revenue < baseline.avgRevenue * 0.5) {
    alerts.push({
      type: "revenue_drop",
      severity: "high",
      message: "Revenue drop detected",
      explain: `revenue=${current.revenue.toFixed(2)} < 50% of baseline avg (${baseline.avgRevenue.toFixed(2)})`,
    });
  }

  return alerts;
}
