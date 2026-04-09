/**
 * tests/api/contentHome.test.ts
 * Ensures GET /api/backoffice/content/home insert path satisfies content_pages_tree_placement_check.
 * When creating the home page, insert MUST include tree_root_key and tree_sort_order.
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit) {
  return new Request(url, init ?? {}) as any;
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

const MOCK_RID = "rid_content_home";

const { scopeOr401Mock } = vi.hoisted(() => ({ scopeOr401Mock: vi.fn() }));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: vi.fn(() => null),
}));

const { capturedInsert } = vi.hoisted(() => ({ capturedInsert: [] as { table: string; payload: Record<string, unknown> }[] }));
vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "content_pages") {
        return {
          select: (_cols: string) => ({
            eq: (_col: string, _val: string) => ({
              maybeSingle: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => {
            capturedInsert.push({ table, payload });
            return {
              select: (_cols: string) => ({
                single: () =>
                  Promise.resolve({
                    data: { id: "home-page-id", title: "Hjem", slug: "home", status: "draft", updated_at: new Date().toISOString() },
                    error: null,
                  }),
              }),
            };
          },
          delete: () => ({ eq: () => Promise.resolve({ error: null }) }),
        };
      }
      if (table === "content_page_variants") {
        return {
          insert: () => Promise.resolve({ error: null }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
  };
});

import { GET as ContentHomeGET } from "../../app/api/backoffice/content/home/route";

describe("Content home API — tree placement on insert", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedInsert.length = 0;
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: MOCK_RID, route: "/api/backoffice/content/home", method: "GET", scope: { role: "superadmin" } },
    });
  });

  test("when creating home page, insert includes tree_root_key and tree_sort_order (DB constraint)", async () => {
    const req = mkReq("http://localhost/api/backoffice/content/home", { method: "GET" });
    const res = await ContentHomeGET(req);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);

    const contentPagesInsert = capturedInsert.find((c) => c.table === "content_pages");
    expect(contentPagesInsert).toBeDefined();
    expect(contentPagesInsert!.payload.tree_root_key).toBe("home");
    expect(contentPagesInsert!.payload.tree_sort_order).toBe(0);
  });
});
