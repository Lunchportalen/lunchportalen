// tests/auth/postLoginRedirectSafety.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

const getAuthContextMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: getAuthContextMock,
}));

function mkReq(url: string): any {
  return {
    nextUrl: new URL(url),
    headers: new Headers(),
    cookies: {
      getAll() {
        return [];
      },
    },
  };
}

describe("POST-login redirect safety (/api/auth/post-login GET)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("rejects unsafe next (external-style) and falls back to role home", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      mode: "DB_LOOKUP",
      user: { id: "u1", email: "emp@test.no" },
      role: "employee",
      company_id: "c1",
      location_id: "l1",
      rid: "rid_test",
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login?next=//evil.com");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location.includes("/week")).toBe(true);
    expect(location).not.toContain("evil.com");
  });

  test("employee next=/orders falls back to /week (employee allowlist)", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      mode: "DB_LOOKUP",
      user: { id: "u1", email: "emp@test.no" },
      role: "employee",
      company_id: "c1",
      location_id: "l1",
      rid: "rid_emp_orders",
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login?next=/orders");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location.includes("/week")).toBe(true);
    expect(location.includes("/orders")).toBe(false);
  });

  test("employee unsafe next=/admin falls back to role landing (E5 allowNextForRole)", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      mode: "DB_LOOKUP",
      user: { id: "u1", email: "emp@test.no" },
      role: "employee",
      company_id: "c1",
      location_id: "l1",
      rid: "rid_emp_admin",
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login?next=/admin");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location.includes("/week")).toBe(true);
    expect(location.includes("/admin")).toBe(false);
  });

  test("superadmin unsafe next=/week falls back to landing (E5 — /superadmin*)", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      mode: "DB_LOOKUP",
      user: { id: "u1", email: "sa@test.no" },
      role: "superadmin",
      company_id: null,
      location_id: null,
      rid: "rid_sa_week",
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login?next=/week");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location.includes("/superadmin")).toBe(true);
    expect(location.includes("/week")).toBe(false);
  });
});
