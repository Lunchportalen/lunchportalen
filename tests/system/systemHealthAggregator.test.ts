/**
 * systemHealthAggregator: getSystemHealth returns structured result and never exposes sensitive data.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("@/lib/env/system", () => ({
  validateSystemRuntimeEnv: vi.fn(() => ({ ok: true })),
}));

describe("systemHealthAggregator", () => {
  beforeEach(async () => {
    const mod = await import("@/lib/env/system");
    vi.mocked(mod.validateSystemRuntimeEnv).mockReturnValue({ ok: true });
  });

  it("getSystemHealth is exported and returns result with required keys", async () => {
    const { getSystemHealth } = await import("@/lib/system/systemHealthAggregator");

    const okProfiles = { limit: () => Promise.resolve({ data: [{}], error: null }) };
    const okOutboxLimit = { limit: () => Promise.resolve({ error: null }) };
    const admin = {
      from: (table: string) => ({
        select: (_cols: string, opts?: { count?: string; head?: boolean }) => {
          if (table === "profiles") return okProfiles;
          if (table === "cron_runs")
            return { gte: () => Promise.resolve({ data: [{ status: "ok" }, { status: "ok" }], error: null, count: 2 }) };
          if (table === "outbox" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "ai_jobs" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "outbox" && !opts?.head) return okOutboxLimit;
          return Promise.resolve({ data: [], error: null, count: 0 });
        },
        eq: () => Promise.resolve({ error: null, count: 0 }),
        gte: () => Promise.resolve({ data: [{ status: "ok" }], error: null, count: 1 }),
      }),
    };

    const result = await getSystemHealth(admin as any);

    expect(result).toBeDefined();
    expect(result.status).toMatch(/^(ok|degraded|critical)$/);
    expect(typeof result.database).toBe("string");
    expect(typeof result.cron).toBe("string");
    expect(typeof result.outbox).toBe("string");
    expect(typeof result.ai_jobs).toBe("string");
    expect(typeof result.migrations).toBe("string");
    expect(typeof result.timestamp).toBe("string");
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("result never contains env var names or connection strings", async () => {
    const { getSystemHealth } = await import("@/lib/system/systemHealthAggregator");

    const admin = {
      from: (table: string) => ({
        select: (_c: string, opts?: { head?: boolean }) => {
          if (table === "profiles") return { limit: () => Promise.resolve({ data: [{}], error: null }) };
          if (table === "cron_runs") return { gte: () => Promise.resolve({ data: [{ status: "ok" }], error: null, count: 1 }) };
          if (table === "outbox" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "ai_jobs" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "outbox") return { limit: () => Promise.resolve({ error: null }) };
          return Promise.resolve({ error: null, count: 0 });
        },
        eq: () => Promise.resolve({ error: null, count: 0 }),
        gte: () => Promise.resolve({ data: [], error: null, count: 0 }),
      }),
    };

    const result = await getSystemHealth(admin as any);
    const payload = JSON.stringify(result);

    expect(payload).not.toMatch(/SUPABASE|DATABASE_URL|SYSTEM_MOTOR|password|secret/i);
  });

  it("status is critical when database returns error", async () => {
    const { getSystemHealth } = await import("@/lib/system/systemHealthAggregator");

    const admin = {
      from: (table: string) => ({
        select: (_c: string, opts?: { head?: boolean }) => {
          if (table === "profiles")
            return { limit: () => Promise.resolve({ data: null, error: { message: "fail" } }) };
          if (table === "cron_runs") return { gte: () => Promise.resolve({ data: [], error: null, count: 0 }) };
          if (table === "outbox" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "ai_jobs" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "outbox") return { limit: () => Promise.resolve({ error: null }) };
          return Promise.resolve({ error: null, count: 0 });
        },
        eq: () => Promise.resolve({ error: null, count: 0 }),
        gte: () => Promise.resolve({ data: [], error: null, count: 0 }),
      }),
    };

    const result = await getSystemHealth(admin as any);
    expect(result.status).toBe("critical");
    expect(result.database).toBe("unavailable");
  });

  it("outbox backlog degrades or breaks health status", async () => {
    const { getSystemHealth } = await import("@/lib/system/systemHealthAggregator");

    // Degraded backlog (between warn and critical thresholds)
    const adminDegraded = {
      from: (table: string) => ({
        select: (_c: string, opts?: { head?: boolean; count?: string }) => {
          if (table === "profiles") return { limit: () => Promise.resolve({ data: [{}], error: null }) };
          if (table === "cron_runs") return { gte: () => Promise.resolve({ data: [{ status: "ok" }], error: null, count: 1 }) };
          if (table === "outbox" && opts?.head)
            return {
              eq: () => Promise.resolve({ error: null, count: 1000 }),
            };
          if (table === "ai_jobs" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "outbox") return { limit: () => Promise.resolve({ error: null }) };
          return Promise.resolve({ error: null, count: 0 });
        },
        eq: () => Promise.resolve({ error: null, count: 0 }),
        gte: () => Promise.resolve({ data: [], error: null, count: 0 }),
      }),
    };

    const degraded = await getSystemHealth(adminDegraded as any);
    expect(degraded.status).toBe("degraded");
    expect(degraded.outbox).toMatch(/elevated/i);

    // Critical backlog (beyond critical threshold)
    const adminCritical = {
      from: (table: string) => ({
        select: (_c: string, opts?: { head?: boolean; count?: string }) => {
          if (table === "profiles") return { limit: () => Promise.resolve({ data: [{}], error: null }) };
          if (table === "cron_runs") return { gte: () => Promise.resolve({ data: [{ status: "ok" }], error: null, count: 1 }) };
          if (table === "outbox" && opts?.head)
            return {
              eq: () => Promise.resolve({ error: null, count: 5001 }),
            };
          if (table === "ai_jobs" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "outbox") return { limit: () => Promise.resolve({ error: null }) };
          return Promise.resolve({ error: null, count: 0 });
        },
        eq: () => Promise.resolve({ error: null, count: 0 }),
        gte: () => Promise.resolve({ data: [], error: null, count: 0 }),
      }),
    };

    const critical = await getSystemHealth(adminCritical as any);
    expect(critical.status).toBe("critical");
    expect(critical.outbox).toMatch(/backlog/i);
  });

  it("cron component is degraded when there are no recent runs", async () => {
    const { getSystemHealth } = await import("@/lib/system/systemHealthAggregator");

    const admin = {
      from: (table: string) => ({
        select: (_c: string, opts?: { head?: boolean; count?: string }) => {
          if (table === "profiles") return { limit: () => Promise.resolve({ data: [{}], error: null }) };
          if (table === "cron_runs") return { gte: () => Promise.resolve({ data: [], error: null, count: 0 }) };
          if (table === "outbox" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "ai_jobs" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "outbox") return { limit: () => Promise.resolve({ error: null }) };
          return Promise.resolve({ error: null, count: 0 });
        },
        eq: () => Promise.resolve({ error: null, count: 0 }),
        gte: () => Promise.resolve({ data: [], error: null, count: 0 }),
      }),
    };

    const result = await getSystemHealth(admin as any);
    expect(result.status).toBe("degraded");
    expect(result.cron).toMatch(/no recent runs/i);
  });

  it("cron component is degraded when cron_runs query errors", async () => {
    const { getSystemHealth } = await import("@/lib/system/systemHealthAggregator");

    const admin = {
      from: (table: string) => ({
        select: (_c: string, opts?: { head?: boolean; count?: string }) => {
          if (table === "profiles") return { limit: () => Promise.resolve({ data: [{}], error: null }) };
          if (table === "cron_runs")
            return {
              gte: () => Promise.resolve({ data: null, error: { message: "db_error" }, count: 0 }),
            };
          if (table === "outbox" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "ai_jobs" && opts?.head) return { eq: () => Promise.resolve({ error: null, count: 0 }) };
          if (table === "outbox") return { limit: () => Promise.resolve({ error: null }) };
          return Promise.resolve({ error: null, count: 0 });
        },
        eq: () => Promise.resolve({ error: null, count: 0 }),
        gte: () => Promise.resolve({ data: [], error: null, count: 0 }),
      }),
    };

    const result = await getSystemHealth(admin as any);
    expect(result.status).toBe("degraded");
    expect(result.cron).toBe("unavailable");
  });
});
