/**
 * Post-login API route: proves request path and truthful failure responses.
 * - POST with missing tokens → 303 to /login?code=NO_TOKENS
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

  test("POST with missing tokens returns 303 to /login with code=NO_TOKENS", async () => {
    const { POST } = await import("@/app/api/auth/post-login/route");
    const req = mkPostReq({});
    const res = await POST(req);
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("code=NO_TOKENS");
  });

  test("POST with empty token strings returns 303 to /login with code=NO_TOKENS", async () => {
    const { POST } = await import("@/app/api/auth/post-login/route");
    const req = mkPostReq({ access_token: "", refresh_token: "" });
    const res = await POST(req);
    expect(res.status).toBe(303);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("code=NO_TOKENS");
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
});
