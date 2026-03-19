// tests/lib/observability-statusAggregator.test.ts
// Tests for aggregate status normalization.

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";
import { getOperationalStatus } from "@/lib/observability/statusAggregator";

describe("observability status aggregator", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("returns critical when runHealthChecks throws", async () => {
    vi.mock("@/lib/system/health", () => ({
      runHealthChecks: vi.fn().mockRejectedValue(new Error("boom")),
    }));

    const admin = {
      from() {
        return {
          select: () => ({ eq: () => ({ data: [], error: null }) }),
          gte: () => ({ in: () => ({ data: [], error: null }) }),
          in: () => ({ data: [], error: null }),
          eq: () => ({ data: [], error: null }),
        };
      },
    };

    const { getOperationalStatus: fn } = await import("@/lib/observability/statusAggregator");
    const status = await fn(admin as any);
    expect(status.status).toBe("critical");
    expect(status.reasons.length).toBeGreaterThan(0);
  });

  test("includes SLO alerts in reasons", async () => {
    vi.mock("@/lib/system/health", () => ({
      runHealthChecks: vi.fn().mockResolvedValue({
        ok: false,
        timestamp: "2026-03-12T10:00:00Z",
        todayOslo: "2026-03-12",
        checks: [{ key: "runtime", status: "fail", message: "Missing env" }],
      }),
    }));
    vi.mock("@/lib/system/healthStatus", () => ({
      deriveSystemStatus: vi.fn().mockReturnValue("degraded"),
      deriveReasons: vi.fn().mockReturnValue(["runtime: Missing env"]),
    }));
    vi.mock("@/lib/observability/sli", () => ({
      computeAllSlis: vi.fn().mockResolvedValue([]),
    }));

    const admin = {
      from() {
        return {
          select: () => ({ eq: () => ({ data: [], error: null }) }),
          gte: () => ({ in: () => ({ data: [], error: null }) }),
          in: () => ({ data: [], error: null }),
          eq: () => ({ data: [], error: null }),
        };
      },
    };

    const { getOperationalStatus: fn } = await import("@/lib/observability/statusAggregator");
    const status = await fn(admin as any);
    expect(status.status).toBe("critical");
    expect(status.reasons.join(" ")).toContain("runtime:");
  });
});

