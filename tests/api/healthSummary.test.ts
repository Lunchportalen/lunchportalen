/**
 * Lightweight readiness check for /api/health summary.
 * Verifies that summary.status reflects dependency degradation.
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

const dbFailing = vi.hoisted(() => ({ value: false }));
const envFailing = vi.hoisted(() => ({ value: false }));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (_table: string) => ({
      select: () => ({
        limit: () =>
          dbFailing.value
            ? Promise.resolve({ data: null, error: { message: "connection refused" } })
            : Promise.resolve({ data: [{}], error: null }),
      }),
    }),
  }),
}));

vi.mock("@/lib/env/system", async (orig) => {
  const actual = await orig();
  return {
    ...actual,
    validateSystemRuntimeEnv: () => (envFailing.value ? { ok: false, missing: ["SYSTEM_MOTOR_SECRET"] } : { ok: true }),
  };
});

import { GET as HealthGET } from "../../app/api/health/route";

describe("Health summary (platform core)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbFailing.value = false;
    envFailing.value = false;
  });

  test("summary.status is 'ok' when all dependencies are healthy", async () => {
    const res = await HealthGET();
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data?.summary?.status).toBe("ok");
    expect(data.data?.summary?.supabase).toBe("ok");
    expect(data.data?.summary?.env).toBe("ok");
  });

  test("summary.status is 'failed' and HTTP 503 when DB query fails", async () => {
    dbFailing.value = true;
    const res = await HealthGET();
    expect(res.status).toBe(503);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("HEALTH_FAILED");
    expect(data.detail?.summary?.status).toBe("failed");
    expect(data.detail?.summary?.supabase).toBe("failed");
  });

  test("summary.status is 'failed' when env validation fails", async () => {
    envFailing.value = true;
    const res = await HealthGET();
    expect(res.status).toBe(503);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("HEALTH_FAILED");
    expect(data.detail?.summary?.status).toBe("failed");
    expect(data.detail?.summary?.env).toBe("failed");
  });
});

