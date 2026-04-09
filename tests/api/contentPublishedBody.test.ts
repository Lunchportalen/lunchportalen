/**
 * GET /api/backoffice/content/pages/[id]/published-body
 * Returns prod variant body for preview parity in editor. Auth: superadmin.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  const { headers = {}, ...rest } = init ?? {};
  return new Request(url, { ...rest, headers }) as any;
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

const MOCK_RID = "rid_published_body";

const { scopeOr401Mock } = vi.hoisted(() => ({ scopeOr401Mock: vi.fn() }));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: vi.fn((ctx: any, roles: string[]) =>
    roles.includes(ctx?.scope?.role) ? null : new Response(JSON.stringify({ ok: false }), { status: 403 })
  ),
}));

let mockVariantByPage: Record<string, { id: string; body: unknown } | null> = {};

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "content_page_variants") throw new Error(`Unexpected table: ${table}`);
      const q: any = {
        _pageId: undefined as string | undefined,
        _locale: undefined as string | undefined,
        _env: undefined as string | undefined,
        select() {
          return q;
        },
        eq(col: string, val: string) {
          if (col === "page_id") q._pageId = val;
          if (col === "locale") q._locale = val;
          if (col === "environment") q._env = val;
          return q;
        },
        maybeSingle(): Promise<{ data: any; error: null }> {
          if (q._pageId != null && q._locale === "nb" && q._env === "prod") {
            const variant = mockVariantByPage[q._pageId] ?? null;
            return Promise.resolve({ data: variant, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return q;
    },
  }),
  };
});

import { GET as PublishedBodyGET } from "../../app/api/backoffice/content/pages/[id]/published-body/route";

describe("GET /api/backoffice/content/pages/[id]/published-body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVariantByPage = {};
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: MOCK_RID, scope: { role: "superadmin" } },
    });
  });

  test("returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({ ok: false, res: new Response(null, { status: 401 }) });
    const req = mkReq("http://localhost/api/backoffice/content/pages/page-1/published-body", {
      method: "GET",
    });
    const res = await PublishedBodyGET(req, { params: Promise.resolve({ id: "page-1" }) });
    expect(res.status).toBe(401);
  });

  test("returns 400 when id is empty", async () => {
    const req = mkReq("http://localhost/api/backoffice/content/pages/ /published-body", {
      method: "GET",
    });
    const res = await PublishedBodyGET(req, { params: Promise.resolve({ id: " " }) });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("returns 404 when no prod variant exists", async () => {
    mockVariantByPage["page-no-prod"] = null;

    const req = mkReq("http://localhost/api/backoffice/content/pages/page-no-prod/published-body", {
      method: "GET",
    });
    const res = await PublishedBodyGET(req, { params: Promise.resolve({ id: "page-no-prod" }) });
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("returns 200 with body when prod variant exists (preview vs published distinction)", async () => {
    const prodBody = {
      version: 1,
      blocks: [{ id: "b1", type: "hero", data: { title: "Publisert tittel" } }],
      meta: { seo: { title: "SEO" } },
    };
    mockVariantByPage["page-with-prod"] = { id: "v-prod", body: prodBody };

    const req = mkReq("http://localhost/api/backoffice/content/pages/page-with-prod/published-body", {
      method: "GET",
    });
    const res = await PublishedBodyGET(req, { params: Promise.resolve({ id: "page-with-prod" }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    const body = json.data?.body ?? json.body;
    expect(body).toEqual(prodBody);
  });
});
