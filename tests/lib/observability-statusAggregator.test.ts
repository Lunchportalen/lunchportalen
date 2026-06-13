// tests/lib/observability-statusAggregator.test.ts
// Tests for aggregate status normalization.

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

const {
  runHealthChecksMock,
  deriveSystemStatusMock,
  deriveReasonsMock,
  computeAllSlisMock,
} = vi.hoisted(() => ({
  runHealthChecksMock: vi.fn(),
  deriveSystemStatusMock: vi.fn(),
  deriveReasonsMock: vi.fn(),
  computeAllSlisMock: vi.fn(),
}));

vi.mock("@/lib/system/health", () => ({
  runHealthChecks: runHealthChecksMock,
}));

vi.mock("@/lib/system/healthStatus", () => ({
  deriveSystemStatus: deriveSystemStatusMock,
  deriveReasons: deriveReasonsMock,
}));

vi.mock("@/lib/observability/sli", () => ({
  computeAllSlis: computeAllSlisMock,
}));

const adminStub = {
  from() {
    return {
      select: () => ({ eq: () => ({ data: [], error: null }) }),
      gte: () => ({ in: () => ({ data: [], error: null }) }),
      in: () => ({ data: [], error: null }),
      eq: () => ({ data: [], error: null }),
    };
  },
};

describe("observability status aggregator", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    deriveSystemStatusMock.mockReturnValue("degraded");
    deriveReasonsMock.mockReturnValue([]);
    computeAllSlisMock.mockResolvedValue([]);
  });

  test("returns critical when runHealthChecks throws", async () => {
    runHealthChecksMock.mockRejectedValue(new Error("boom"));

    const { getOperationalStatus: fn } = await import("@/lib/observability/statusAggregator");
    const status = await fn(adminStub as any);
    expect(status.status).toBe("critical");
    expect(status.reasons.length).toBeGreaterThan(0);
  });

  test("includes SLO alerts in reasons", async () => {
    runHealthChecksMock.mockResolvedValue({
      ok: false,
      timestamp: "2026-03-12T10:00:00Z",
      todayOslo: "2026-03-12",
      checks: [{ key: "runtime", status: "fail", message: "Missing env" }],
    });
    deriveSystemStatusMock.mockReturnValue("degraded");
    deriveReasonsMock.mockReturnValue(["runtime: Missing env"]);

    const { getOperationalStatus: fn } = await import("@/lib/observability/statusAggregator");
    const status = await fn(adminStub as any);
    expect(status.status).toBe("critical");
    expect(status.reasons.join(" ")).toContain("runtime:");
  });
});
