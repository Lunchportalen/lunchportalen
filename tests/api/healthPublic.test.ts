/**
 * tests/api/healthPublic.test.ts
 * Public health endpoint: does not fake OK when DB or sanity fails.
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

vi.mock("@/lib/env/system", () => ({
  validateSystemRuntimeEnv: () =>
    envFailing.value ? { ok: false, missing: ["SYSTEM_MOTOR_SECRET"] } : { ok: true },
}));

import { GET as HealthGET } from "../../app/api/health/route";

describe("Public health API — no fake OK", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbFailing.value = false;
    envFailing.value = false;
  });

  test("returns 200 and ok: true when DB and sanity succeed", async () => {
    const res = await HealthGET();
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data?.checks).toBeDefined();
    expect(data.data?.checks?.supabase?.ok).toBe(true);
    expect(data.data?.checks?.db_schema?.ok).toBe(true);
  });

  test("returns 503 and ok: false when DB query fails", async () => {
    dbFailing.value = true;
    const res = await HealthGET();
    expect(res.status).toBe(503);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("HEALTH_FAILED");
    // Operational truth: missing critical dep must not report status ok (detail in RC/dev/test)
    const detail = data.detail;
    expect(detail?.summary?.status).toBe("failed");
    expect(detail?.summary?.supabase).toBe("failed");
  });

  test("returns 503 and ok: false when system runtime env is invalid (env fail-closed)", async () => {
    envFailing.value = true;
    const res = await HealthGET();
    expect(res.status).toBe(503);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("HEALTH_FAILED");
    const detail = data.detail;
    expect(detail?.summary?.status).toBe("failed");
    expect(detail?.summary?.env).toBe("failed");
  });
});
