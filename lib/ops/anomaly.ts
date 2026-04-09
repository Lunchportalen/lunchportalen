import "server-only";

export type GlobalMetrics = {
  ts: number;
  uptimeSec: number | null;
  region: string;
};

/**
 * Enkel anomalideteksjon (stub — utvid med terskler / SLO).
 */
export function detectAnomaly(metrics: GlobalMetrics | null): void {
  if (!metrics) {
    console.warn("[ANOMALY]", { reason: "missing_metrics" });
    return;
  }
  if (metrics.uptimeSec !== null && metrics.uptimeSec < 5) {
    console.warn("[ANOMALY]", metrics);
  }
}
