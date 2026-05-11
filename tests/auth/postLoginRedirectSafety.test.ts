// tests/auth/postLoginRedirectSafety.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

const getAuthContextMock = vi.hoisted(() => vi.fn());
const supabaseServerMock = vi.hoisted(() => vi.fn());
const hasActiveAgreementFlag = vi.hoisted(() => ({ value: true }));

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: supabaseServerMock,
}));

supabaseServerMock.mockImplementation(async () => ({
  from: (_table: string) => ({
    select: (_cols: string) => ({
      eq: (_col: string, _val: string) => ({
        eq: (_col2: string, _val2: string) => ({
          limit: (_n: number) => ({
            maybeSingle: async () => ({
              data: hasActiveAgreementFlag.value ? { id: "agreement_1" } : null,
              error: null,
            }),
          }),
        }),
      }),
    }),
  }),
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
    hasActiveAgreementFlag.value = true;
  });

  test("company_admin without next lands on /admin", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      mode: "DB_LOOKUP",
      user: { id: "u1", email: "admin@test.no" },
      role: "company_admin",
      company_id: "c1",
      location_id: "l1",
      rid: "rid_company_admin",
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location.includes("/admin")).toBe(true);
    expect(location.includes("/week")).toBe(false);
  });

  test("legacy company admin role aliases land on /admin", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      mode: "DB_LOOKUP",
      user: { id: "u1", email: "admin@test.no" },
      role: "companyadmin",
      company_id: "c1",
      location_id: "l1",
      rid: "rid_companyadmin_alias",
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login?next=/week");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location.includes("/admin")).toBe(true);
    expect(location.includes("/week")).toBe(false);
  });

  test("company_admin without active agreement is short-circuited to /avtale-ikke-aktiv", async () => {
    hasActiveAgreementFlag.value = false;
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      mode: "DB_LOOKUP",
      user: { id: "u1", email: "admin@test.no" },
      role: "company_admin",
      company_id: "c1",
      location_id: null,
      rid: "rid_ca_no_agreement",
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location.includes("/avtale-ikke-aktiv")).toBe(true);
    expect(location.includes("/admin")).toBe(false);
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

  test("superadmin next=/umbraco is preserved (Umbraco CMS path — E5 allowNextForRole)", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: true,
      reason: "OK",
      mode: "DB_LOOKUP",
      user: { id: "u1", email: "sa@test.no" },
      role: "superadmin",
      company_id: null,
      location_id: null,
      rid: "rid_sa_umbraco",
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login?next=/umbraco");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location.includes("/umbraco")).toBe(true);
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

  test("auth NO_PROFILE redirects to /login?code=NO_PROFILE (not /week)", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: false,
      reason: "NO_PROFILE",
      userId: "u1",
      user: { id: "u1", email: "x@y.no" },
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location).toContain("/login");
    expect(location).toContain("code=NO_PROFILE");
    expect(location).not.toContain("/week");
  });

  test("auth BLOCKED redirects to /login?code=BLOCKED", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: false,
      reason: "BLOCKED",
      userId: "u1",
      user: { id: "u1", email: "x@y.no" },
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location).toContain("code=BLOCKED");
  });

  test("auth ERROR redirects to /login?code=AUTH_ERROR", async () => {
    getAuthContextMock.mockResolvedValue({
      ok: false,
      reason: "ERROR",
      userId: null,
      user: null,
    });

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location).toContain("code=AUTH_ERROR");
  });
});
