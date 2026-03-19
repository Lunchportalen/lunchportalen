/**
 * Minimal smoke: critical surfaces do not crash and key API routes return non-500.
 * No business logic; no refactor. Priority: auth/login, backoffice/admin, main API, critical lib.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function makeGetReq(url: string) {
  return { nextUrl: new URL(url), headers: new Headers(), method: "GET" } as any;
}

function makePostReq(url: string, contentType: string, body: string) {
  const headers = new Headers();
  if (contentType) headers.set("Content-Type", contentType);
  return {
    nextUrl: new URL(url),
    headers,
    method: "POST",
    text: () => Promise.resolve(body),
    json: () => Promise.resolve(body ? JSON.parse(body) : {}),
  } as any;
}

describe("Smoke — critical surfaces", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("GET /api/health returns response with status !== 500", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    expect(res).toBeInstanceOf(Response);
    expect(res.status).not.toBe(500);
  });

  test("GET /api/superadmin/system/status returns response with status !== 500", async () => {
    const { GET } = await import("@/app/api/superadmin/system/status/route");
    const res = await GET(makeGetReq("http://x/api/superadmin/system/status"));
    expect(res).toBeInstanceOf(Response);
    expect(res.status).not.toBe(500);
  });

  test("POST /api/auth/login with JSON returns response with status !== 500", async () => {
    const { POST } = await import("@/app/api/auth/login/route");
    const req = makePostReq(
      "http://x/api/auth/login",
      "application/json",
      "{}"
    );
    const res = await POST(req);
    expect(res).toBeInstanceOf(Response);
    expect(res.status).not.toBe(500);
  });

  test("lib/env/system validates without throw", async () => {
    const { validateSystemRuntimeEnv } = await import("@/lib/env/system");
    const report = validateSystemRuntimeEnv();
    expect(report).toBeDefined();
    expect(report.ok === true || (report.ok === false && Array.isArray(report.missing))).toBe(true);
  });
});
