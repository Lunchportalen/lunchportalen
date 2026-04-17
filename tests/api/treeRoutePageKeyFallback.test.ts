/**
 * U30R — GET /api/backoffice/content/tree faller tilbake uten page_key-kolonne.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";

function mkReq(url: string) {
  return new Request(url, { method: "GET" }) as import("next/server").NextRequest;
}

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());

let fetchCall = 0;

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        order: () => ({
          order: () => {
            fetchCall += 1;
            if (fetchCall === 1) {
              return Promise.resolve({
                data: null,
                error: { message: 'column content_pages.page_key does not exist' },
              });
            }
            return Promise.resolve({
              data: [
                {
                  id: "p1",
                  title: "Forside",
                  slug: "home",
                  status: "published",
                  tree_parent_id: null,
                  tree_root_key: "home",
                  tree_sort_order: 0,
                },
              ],
              error: null,
            });
          },
        }),
      }),
    }),
  }),
}));

describe("GET /api/backoffice/content/tree — page_key column fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchCall = 0;
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_t", scope: { role: "superadmin", userId: "u1", companyId: null, locationId: null } },
    });
    requireRoleOr403Mock.mockReturnValue(null);
  });

  test("returns 200 with schemaHints and inferred home kind", async () => {
    vi.resetModules();
    const { GET } = await import("@/app/api/backoffice/content/tree/route");
    const res = await GET(mkReq("http://localhost/api/backoffice/content/tree"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok?: boolean;
      data?: {
        roots?: unknown[];
        operatorMessage?: string;
        schemaHints?: { pageKeyColumnMissing?: boolean; missingColumns?: string[]; code?: string | null };
      };
    };
    expect(body.ok).toBe(true);
    expect(body.data?.schemaHints?.pageKeyColumnMissing).toBe(true);
    expect(body.data?.schemaHints?.missingColumns).toEqual(["page_key"]);
    expect(body.data?.operatorMessage).toContain("slug-basert reserve");
    expect(Array.isArray(body.data?.roots)).toBe(true);
    expect(fetchCall).toBe(2);
  });
});
