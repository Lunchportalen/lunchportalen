/**
 * GET /api/backoffice/content/tree auth guard: 401 unauthenticated, 403 when not superadmin.
 * API failure (500) returns JSON so client can show safe message.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string) {
  return new Request(url, { method: "GET" }) as any;
}

async function readJson(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return { _raw: t };
  }
}

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
}));

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
  };
});

describe("GET /api/backoffice/content/tree — auth and safe failure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns 401 when unauthenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    });

    const { GET } = await import("@/app/api/backoffice/content/tree/route");
    const res = await GET(mkReq("http://localhost/api/backoffice/content/tree"));
    expect(res.status).toBe(401);
    const data = await readJson(res);
    expect(data?.ok).toBe(false);
  });

  test("returns 403 when authenticated but not superadmin", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_test", scope: { role: "company_admin", userId: "u1", companyId: "c1", locationId: null } },
    });
    requireRoleOr403Mock.mockReturnValue(
      new Response(JSON.stringify({ ok: false, error: "FORBIDDEN", message: "Ingen tilgang." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      })
    );

    const { GET } = await import("@/app/api/backoffice/content/tree/route");
    const res = await GET(mkReq("http://localhost/api/backoffice/content/tree"));
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data?.ok).toBe(false);
  });

  test("returns 200 with roots when superadmin (API success)", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_test", scope: { role: "superadmin", userId: "u1", companyId: null, locationId: null } },
    });
    requireRoleOr403Mock.mockReturnValue(null);

    const { GET } = await import("@/app/api/backoffice/content/tree/route");
    const res = await GET(mkReq("http://localhost/api/backoffice/content/tree"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data?.ok).toBe(true);
    expect(Array.isArray(data?.data?.roots)).toBe(true);
  });
});
