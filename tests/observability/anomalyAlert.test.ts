import { describe, expect, test } from "vitest";

import { shouldSendAlert } from "@/lib/observability/alertThrottle";
import { detectAnomalies } from "@/lib/observability/anomalyEngine";
import { buildMetricsSnapshot } from "@/lib/observability/metricsEngine";

describe("anomaly + alert throttle", () => {
  test("detectAnomalies flags conversion and traffic combo", () => {
    const s = buildMetricsSnapshot({
      conversion: 0.005,
      churn: 0,
      revenue: 1,
      traffic: 2000,
    });
    const a = detectAnomalies(s);
    expect(a).toContain("CRITICAL_LOW_CONVERSION");
    expect(a).toContain("TRAFFIC_NOT_CONVERTING");
  });

  test("shouldSendAlert rate limits within window", () => {
    const k = `throttle-${Math.random().toString(36).slice(2)}`;
    expect(shouldSendAlert(k)).toBe(true);
    expect(shouldSendAlert(k)).toBe(false);
  });
});
