import "server-only";

import { detectAnomaly, type GlobalMetrics } from "@/lib/ops/anomaly";

export type { GlobalMetrics } from "@/lib/ops/anomaly";

export function collectGlobalMetrics(): GlobalMetrics {
  const ts = Date.now();
  const uptimeSec = typeof process !== "undefined" && typeof process.uptime === "function" ? process.uptime() : null;

  const metrics: GlobalMetrics = {
    ts,
    uptimeSec,
    region: String(process.env.VERCEL_REGION ?? "").trim() || "global",
  };

  detectAnomaly(metrics);
  return metrics;
}
