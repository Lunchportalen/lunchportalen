import { spawnSync } from "node:child_process";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const dbFailing = vi.hoisted(() => ({ value: false }));
const envFailing = vi.hoisted(() => ({ value: false }));

vi.mock("@/lib/supabase/admin", async () => {
  return {
    hasSupabaseAdminConfig: () => false,
    supabaseAdmin: (() =>
      ({
        from: (_table: string) => ({
          select: () => ({
            limit: () =>
              dbFailing.value
                ? Promise.resolve({ data: null, error: { message: "connection refused" } })
                : Promise.resolve({ data: [{}], error: null }),
          }),
        }),
      })) as any,
  };
});

vi.mock("@/lib/env/system", () => ({
  validateSystemRuntimeEnv: () =>
    envFailing.value ? { ok: false, missing: ["SYSTEM_MOTOR_SECRET"] } : { ok: true },
}));

async function readJson(res: Response) {
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const scriptPath = path.resolve(process.cwd(), "scripts/sanity-live.mjs");

describe.sequential("Sanity and health truth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    dbFailing.value = false;
    envFailing.value = false;
    delete process.env.LP_CMS_RUNTIME_MODE;
    delete process.env.LOCAL_DEV_CONTENT_RESERVE;
    delete process.env.LP_LOCAL_CMS_RUNTIME;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("health keeps local_provider green while reporting remote degradation honestly", async () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "local_provider");
    dbFailing.value = true;

    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const json = await readJson(res);

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.summary.runtime).toBe("local_provider");
    expect(json.data.summary.remote_backend).toBe("degraded");
    expect(json.data.checks.runtime.mode).toBe("local_provider");
  });

  test("health fails when remote_backend mode requires a dead remote backend", async () => {
    vi.stubEnv("LP_CMS_RUNTIME_MODE", "remote_backend");
    dbFailing.value = true;

    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const json = await readJson(res);

    expect(res.status).toBe(503);
    expect(json.ok).toBe(false);
    expect(json.detail.summary.runtime).toBe("remote_backend");
    expect(json.detail.summary.remote_backend).toBe("failed");
    expect(json.detail.checks.runtime.mode).toBe("remote_backend");
  });

  test("sanity-live no longer soft-passes when the endpoint is unreachable", () => {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        SANITY_LIVE_URL: "http://127.0.0.1:9",
        SANITY_FETCH_TIMEOUT_MS: "100",
      },
      encoding: "utf8",
    });

    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("sanity_live_error");
  });
});
