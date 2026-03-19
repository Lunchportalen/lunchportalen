/**
 * tests/api/contentPages.test.ts
 * Backoffice content pages API: auth gate and critical write path behavior.
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string>; body?: unknown }) {
  const { headers = {}, body, ...rest } = init ?? {};
  const opts: RequestInit = { ...rest, headers: headers as HeadersInit };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    (opts as any).headers = { ...(opts.headers as object || {}), "content-type": "application/json" };
  }
  return new Request(url, opts) as any;
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

const MOCK_RID = "rid_content_pages";

const { scopeOr401Mock } = vi.hoisted(() => ({ scopeOr401Mock: vi.fn() }));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: vi.fn(() => null),
  q: vi.fn(() => null),
}));

const state = vi.hoisted(() => ({ pagesInsertError: null as { code: string } | null }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "content_pages") {
        return {
          select: () => ({
            order: () => ({
              order: () => ({
                order: () => ({
                  limit: () =>
                    Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
          insert: (payload: Record<string, unknown>) => ({
            select: () => ({
              single: () =>
                state.pagesInsertError
                  ? Promise.resolve({ data: null, error: state.pagesInsertError })
                  : Promise.resolve({
                      data: { id: "new-page-id", title: payload.title ?? "Ny side", slug: payload.slug ?? "ny-side" },
                      error: null,
                    }),
            }),
          }),
        };
      }
      if (table === "content_page_variants") {
        return { insert: () => Promise.resolve({ error: null }) };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { GET as ContentPagesGET, POST as ContentPagesPOST } from "../../app/api/backoffice/content/pages/route";

describe("Backoffice content pages API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.pagesInsertError = null;
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: MOCK_RID, route: "/api/backoffice/content/pages", method: "GET", scope: { role: "superadmin" } },
    });
  });

  test("GET returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false }), { status: 401 }),
    });
    const req = mkReq("http://localhost/api/backoffice/content/pages", { method: "GET" });
    const res = await ContentPagesGET(req);
    expect(res.status).toBe(401);
  });

  test("GET returns 200 with items when authenticated", async () => {
    const req = mkReq("http://localhost/api/backoffice/content/pages", { method: "GET" });
    const res = await ContentPagesGET(req);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    const items = data.data?.items ?? data.items;
    expect(Array.isArray(items)).toBe(true);
  });

  test("POST returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false }), { status: 401 }),
    });
    const req = mkReq("http://localhost/api/backoffice/content/pages", {
      method: "POST",
      body: { title: "Test", slug: "test" },
    });
    const res = await ContentPagesPOST(req);
    expect(res.status).toBe(401);
  });

  test("POST returns 409 when slug already exists (unique violation)", async () => {
    state.pagesInsertError = { code: "23505" };
    const req = mkReq("http://localhost/api/backoffice/content/pages", {
      method: "POST",
      body: { title: "Test", slug: "existing-slug" },
    });
    const res = await ContentPagesPOST(req);
    expect(res.status).toBe(409);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("SLUG_TAKEN");
  });
});
