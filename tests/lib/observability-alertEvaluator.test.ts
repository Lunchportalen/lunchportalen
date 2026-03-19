// tests/lib/observability-alertEvaluator.test.ts
// Tests for alert severity mapping from SLI status.

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";
import { evaluateAlerts } from "@/lib/observability/alertEvaluator";
import { SLO_REGISTRY } from "@/lib/observability/sloRegistry";

describe("observability alert evaluator", () => {
  const nowIso = "2026-03-12T10:00:00.000Z";

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("produces critical alert for breach", () => {
    const sli = {
      sloId: "system_health",
      sliKey: SLO_REGISTRY.system_health.sliKey,
      serviceId: SLO_REGISTRY.system_health.serviceId,
      good: 0,
      total: 10,
      ratePercent: 80,
      status: "breach",
      message: "Mange sjekker feiler.",
    };

    const alerts = evaluateAlerts([sli as any], nowIso);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("critical");
    expect(alerts[0].sloId).toBe("system_health");
    expect(alerts[0].serviceId).toBe(SLO_REGISTRY.system_health.serviceId);
  });

  test("produces warning alert for warn", () => {
    const sli = {
      sloId: "content_publish",
      sliKey: SLO_REGISTRY.content_publish.sliKey,
      serviceId: SLO_REGISTRY.content_publish.serviceId,
      good: 0,
      total: 1,
      ratePercent: 0,
      status: "warn",
      message: "En SANITY-incident åpen.",
    };

    const alerts = evaluateAlerts([sli as any], nowIso);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].severity).toBe("warning");
  });

  test("does not emit alert for ok", () => {
    const sli = {
      sloId: "order_write",
      sliKey: SLO_REGISTRY.order_write.sliKey,
      serviceId: SLO_REGISTRY.order_write.serviceId,
      good: 1,
      total: 1,
      ratePercent: 100,
      status: "ok",
      message: "Ingen åpne ORDER-incidents.",
    };

    const alerts = evaluateAlerts([sli as any], nowIso);
    expect(alerts).toHaveLength(0);
  });
});

