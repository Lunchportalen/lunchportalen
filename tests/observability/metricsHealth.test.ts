import { describe, expect, test } from "vitest";

import { checkAlerts } from "@/lib/observability/alertEngine";
import { evaluateSystemHealth } from "@/lib/observability/healthEngine";
import { buildMetricsSnapshot } from "@/lib/observability/metricsEngine";

describe("observability metrics + health", () => {
  test("buildMetricsSnapshot normalizes numbers", () => {
    const s = buildMetricsSnapshot({
      revenue: 1,
      mrr: 2,
      conversion: 0.03,
      churn: 0.01,
      traffic: 100,
      experiments: 2,
    });
    expect(s.conversion).toBe(0.03);
    expect(s.experiments).toBe(2);
    expect(s.timestamp).toBeGreaterThan(0);
  });

  test("evaluateSystemHealth thresholds", () => {
    const good = buildMetricsSnapshot({
      conversion: 0.05,
      churn: 0.01,
      experiments: 3,
    });
    expect(evaluateSystemHealth(good).status).toBe("healthy");
    const bad = buildMetricsSnapshot({
      conversion: 0.01,
      churn: 0.06,
      experiments: 0,
    });
    const h = evaluateSystemHealth(bad);
    expect(h.score).toBe(50);
    expect(h.status).toBe("critical");
  });

  test("checkAlerts does not throw", () => {
    const m = buildMetricsSnapshot({ conversion: 0.005, churn: 0.2 });
    expect(() => checkAlerts(m)).not.toThrow();
  });
});
