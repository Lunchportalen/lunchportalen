/**
 * U30X — GET /api/backoffice/content/tree returnerer 200 + degraded ved schema-feil (ikke 500).
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

function mkReq(url: string) {
  return new Request(url, { method: "GET" }) as import("next/server").NextRequest;
}

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          order: () =>
            Promise.resolve({
              data: null,
              error: { code: "42703", message: "column content_pages.foo does not exist" },
            }),
        }),
      }),
    }),
  }),
}));

describe("GET /api/backoffice/content/tree — degradable schema error", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_x", scope: { role: "superadmin", userId: "u1", companyId: null, locationId: null } },
    });
    requireRoleOr403Mock.mockReturnValue(null);
  });

  test("returns 200 with degraded virtual roots", async () => {
    vi.resetModules();
    const { GET } = await import("@/app/api/backoffice/content/tree/route");
    const res = await GET(mkReq("http://localhost/api/backoffice/content/tree"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok?: boolean;
      data?: {
        degraded?: boolean;
        reason?: string;
        operatorAction?: string;
        roots?: { id: string }[];
        schemaHints?: { queryFailed?: boolean; code?: string | null; detail?: string };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data?.degraded).toBe(true);
    expect(body.data?.reason).toBe("SCHEMA_OR_CACHE_UNAVAILABLE");
    expect(body.data?.operatorAction).toContain("Supabase schema/cache");
    expect(body.data?.schemaHints?.queryFailed).toBe(true);
    expect(body.data?.schemaHints?.code).toBe("42703");
    expect(body.data?.schemaHints?.detail).toContain("column content_pages.foo");
    const roots = body.data?.roots ?? [];
    expect(roots.some((r) => r.id === "home")).toBe(true);
  });
});
