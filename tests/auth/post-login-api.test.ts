/**
 * Post-login API route: proves request path and truthful failure responses.
 * - POST with missing tokens → 400 JSON { ok: false }
 * - GET when unauthenticated → 303 to /login?code=NO_SESSION
 * No auth redesign; no weakening.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

const getAuthContextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: getAuthContextMock,
}));

function mkPostReq(body: object) {
  const url = new URL("http://localhost/api/auth/post-login");
  return {
    nextUrl: url,
    json: () => Promise.resolve(body),
    cookies: { getAll: () => [] },
  };
}

function mkGetReq(urlStr = "http://localhost/api/auth/post-login") {
  const url = new URL(urlStr);
  return {
    nextUrl: url,
    headers: new Headers(),
    cookies: { getAll: () => [] },
  };
}

describe("POST /api/auth/post-login — request path and failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("POST with missing tokens returns 400 JSON ok false", async () => {
    const { POST } = await import("@/app/api/auth/post-login/route");
    const req = mkPostReq({});
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; rid?: string };
    expect(json.ok).toBe(false);
    expect(json.rid).toBeTruthy();
  });

  test("POST with empty token strings returns 400 JSON ok false", async () => {
    const { POST } = await import("@/app/api/auth/post-login/route");
    const req = mkPostReq({ access_token: "", refresh_token: "" });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = (await res.json()) as { ok: boolean; rid?: string };
    expect(json.ok).toBe(false);
    expect(json.rid).toBeTruthy();
  });
});

describe("GET /api/auth/post-login — unauthenticated redirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("GET when getAuthContext returns UNAUTHENTICATED returns 303 to /login with code=NO_SESSION", async () => {
    getAuthContextMock.mockResolvedValue({ ok: false, reason: "UNAUTHENTICATED" });
    const { GET } = await import("@/app/api/auth/post-login/route");
    const req = mkGetReq();
    const res = await GET(req);
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("code=NO_SESSION");
  });

  test("GET superadmin ignores unsafe next (e.g. /week) and redirects to /superadmin", async () => {
    getAuthContextMock.mockResolvedValue({ ok: true, role: "superadmin" });
    const { GET } = await import("@/app/api/auth/post-login/route");
    const req = mkGetReq("http://localhost/api/auth/post-login?next=%2Fweek");
    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/superadmin");
    expect(location).not.toContain("/week");
  });

  test("GET superadmin honors next under /superadmin", async () => {
    getAuthContextMock.mockResolvedValue({ ok: true, role: "superadmin" });
    const { GET } = await import("@/app/api/auth/post-login/route");
    const req = mkGetReq("http://localhost/api/auth/post-login?next=%2Fsuperadmin%2Fsystem");
    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/superadmin/system");
  });
});
