/**
 * CMS persistence: save chain (PATCH) and reload (GET) round-trip.
 * Proves that saved content survives re-fetch — not just local state.
 * Content types: page title (simple text) and body (blocks).
 *
 * Proof: PATCH /api/backoffice/content/pages/[id] with title + body
 *        → in-memory store (mock) is updated
 *        → GET same [id] returns the updated title and body.
 * With real Supabase the same path persists to DB; this test proves
 * the API contract and that reload returns the saved value.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string>; body?: unknown }) {
  const { headers = {}, body, ...rest } = init ?? {};
  const opts: RequestInit = { ...rest, headers: { ...headers, "content-type": "application/json" } as HeadersInit };
  if (body !== undefined) opts.body = typeof body === "string" ? body : JSON.stringify(body);
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

const MOCK_RID = "rid_persistence";

const { scopeOr401Mock } = vi.hoisted(() => ({ scopeOr401Mock: vi.fn() }));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: vi.fn(() => null),
  q: vi.fn((req: Request, key: string) => {
    const u = new URL(req.url);
    if (key === "locale") return u.searchParams.get("locale") ?? null;
    if (key === "environment") return u.searchParams.get("environment") ?? null;
    return null;
  }),
}));

// In-memory store: one page + variants. PATCH updates it; GET reads it.
type PageRow = {
  id: string;
  title: string | null;
  slug: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
};
type VariantRow = {
  id: string;
  page_id: string;
  locale: string;
  environment: string;
  body: unknown;
  updated_at: string | null;
};
const store = vi.hoisted(() => ({
  page: null as PageRow | null,
  variants: new Map<string, VariantRow>(), // key = `${pageId}:${locale}:${environment}`
  nextVariantId: 1,
}));

function variantKey(pageId: string, locale: string, env: string) {
  return `${pageId}:${locale}:${env}`;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "content_pages") {
        return {
          select: () => ({
            eq: (col: string, val: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: col === "id" && store.page?.id === val ? store.page : null,
                  error: null,
                }),
            }),
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: (col: string, val: string) => {
              if (col === "id" && store.page?.id === val) {
                store.page = {
                  ...store.page!,
                  ...payload,
                  id: val,
                } as PageRow;
              }
              return Promise.resolve({ error: null });
            },
          }),
        };
      }
      if (table === "content_page_variants") {
        return {
          select: (_cols?: string) => ({
            eq: (col: string, val: string) => {
              const chain: any = {
                _pageId: undefined as string | undefined,
                _locale: undefined as string | undefined,
                _env: undefined as string | undefined,
                _id: undefined as string | undefined,
                eq(c: string, v: string) {
                  if (c === "page_id") chain._pageId = v;
                  if (c === "locale") chain._locale = v;
                  if (c === "environment") chain._env = v;
                  if (c === "id") chain._id = v;
                  return chain;
                },
                order: () => chain,
                limit: () => chain,
                maybeSingle: () => {
                  if (chain._id != null) {
                    const v = [...store.variants.values()].find((x) => x.id === chain._id);
                    return Promise.resolve({ data: v ? { id: v.id } : null, error: null });
                  }
                  if (chain._pageId != null && chain._locale != null && chain._env != null) {
                    const key = variantKey(chain._pageId, chain._locale, chain._env);
                    const v = store.variants.get(key);
                    return Promise.resolve({
                      data: v ? { id: v.id, body: v.body, locale: v.locale, environment: v.environment } : null,
                      error: null,
                    });
                  }
                  return Promise.resolve({ data: null, error: null });
                },
              };
              if (col === "page_id") chain._pageId = val;
              if (col === "locale") chain._locale = val;
              if (col === "environment") chain._env = val;
              return chain;
            },
          }),
          update: (payload: Record<string, unknown>) => ({
            eq: (col: string, val: string) => {
              if (col === "id") {
                const v = [...store.variants.values()].find((x) => x.id === val);
                if (v) {
                  const key = variantKey(v.page_id, v.locale, v.environment);
                  store.variants.set(key, { ...v, ...payload, id: v.id } as VariantRow);
                }
              }
              return Promise.resolve({ error: null });
            },
          }),
          insert: (row: Record<string, unknown>) => {
            const id = `v-${store.nextVariantId++}`;
            const page_id = row.page_id as string;
            const locale = (row.locale as string) || "nb";
            const environment = (row.environment as string) || "prod";
            const key = variantKey(page_id, locale, environment);
            store.variants.set(key, {
              id,
              page_id,
              locale,
              environment,
              body: row.body ?? { version: 1, blocks: [] },
              updated_at: (row.updated_at as string) ?? null,
            });
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { GET as PageByIdGET, PATCH as PageByIdPATCH } from "../../app/api/backoffice/content/pages/[id]/route";

describe("CMS persistence — save then reload returns saved value", () => {
  const PAGE_ID = "page-persistence-test";
  const ctx = { params: Promise.resolve({ id: PAGE_ID }) };

  beforeEach(() => {
    vi.clearAllMocks();
    store.page = {
      id: PAGE_ID,
      title: "Initial title",
      slug: "initial-slug",
      status: "draft",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      published_at: null,
    };
    store.variants.clear();
    store.variants.set(variantKey(PAGE_ID, "nb", "prod"), {
      id: "v-1",
      page_id: PAGE_ID,
      locale: "nb",
      environment: "prod",
      body: { version: 1, blocks: [{ id: "b1", type: "richText", data: { heading: "Initial" } }] },
      updated_at: null,
    });
    store.nextVariantId = 2;
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: MOCK_RID, scope: { role: "superadmin" } },
    });
  });

  test("GET returns initial page and body", async () => {
    const req = mkReq(`http://localhost/api/backoffice/content/pages/${PAGE_ID}`);
    const res = await PageByIdGET(req, ctx);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data?.page?.title).toBe("Initial title");
    const blocks = data.data?.page?.body?.blocks ?? [];
    expect(blocks[0]?.data?.heading).toBe("Initial");
  });

  test("PATCH 200 response includes data.page (client contract: no fake success without persisted page)", async () => {
    const patchReq = mkReq(`http://localhost/api/backoffice/content/pages/${PAGE_ID}`, {
      method: "PATCH",
      body: { title: "Contract check", slug: "initial-slug" },
    });
    const patchRes = await PageByIdPATCH(patchReq, ctx);
    expect(patchRes.status).toBe(200);
    const patchData = await readJson(patchRes);
    expect(patchData.ok).toBe(true);
    expect(patchData.data).toBeDefined();
    expect(patchData.data?.page).toBeDefined();
    expect(typeof patchData.data?.page?.id).toBe("string");
    expect(typeof patchData.data?.page?.title).toBe("string");
    expect(patchData.data?.page?.body).toBeDefined();
  });

  test("PATCH then GET: saved title and body persist (reload returns saved value)", async () => {
    const newTitle = "Persistence verified title";
    const newBody = {
      version: 1,
      blocks: [
        { id: "b1", type: "hero", data: { title: "Saved hero" } },
        { id: "b2", type: "richText", data: { heading: "Saved text" } },
      ],
    };

    const patchReq = mkReq(`http://localhost/api/backoffice/content/pages/${PAGE_ID}`, {
      method: "PATCH",
      body: { title: newTitle, slug: "initial-slug", body: newBody },
    });
    const patchRes = await PageByIdPATCH(patchReq, ctx);
    expect(patchRes.status).toBe(200);
    const patchData = await readJson(patchRes);
    expect(patchData.ok).toBe(true);
    expect(patchData.data?.page).toBeDefined();
    expect(patchData.data?.page?.title).toBe(newTitle);
    expect(patchData.data?.page?.body?.blocks).toEqual(newBody.blocks);

    const getReq = mkReq(`http://localhost/api/backoffice/content/pages/${PAGE_ID}`);
    const getRes = await PageByIdGET(getReq, ctx);
    expect(getRes.status).toBe(200);
    const getData = await readJson(getRes);
    expect(getData.ok).toBe(true);
    expect(getData.data?.page?.title).toBe(newTitle);
    const blocks = getData.data?.page?.body?.blocks ?? [];
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe("hero");
    expect(blocks[0]?.data?.title).toBe("Saved hero");
    expect(blocks[1]?.data?.heading).toBe("Saved text");
  });

  test("edit → save → fetch → compare: persisted body equals saved payload", async () => {
    const editedBody = {
      version: 1,
      blocks: [
        { id: "e1", type: "richText", data: { heading: "Edited heading", body: "Edited text" } },
        { id: "e2", type: "divider", data: {} },
      ],
    };
    const patchRes = await PageByIdPATCH(
      mkReq(`http://localhost/api/backoffice/content/pages/${PAGE_ID}`, {
        method: "PATCH",
        body: { title: "Edited page", slug: "initial-slug", body: editedBody },
      }),
      ctx
    );
    expect(patchRes.status).toBe(200);
    const getRes = await PageByIdGET(mkReq(`http://localhost/api/backoffice/content/pages/${PAGE_ID}`), ctx);
    expect(getRes.status).toBe(200);
    const getData = await readJson(getRes);
    const persistedBody = getData?.data?.page?.body;
    expect(persistedBody).toBeDefined();
    expect(persistedBody.blocks).toHaveLength(2);
    expect(persistedBody.blocks[0].type).toBe("richText");
    expect(persistedBody.blocks[0].data?.heading).toBe("Edited heading");
    expect(persistedBody.blocks[1].type).toBe("divider");
  });

  test("PATCH title only then GET: title persists, body unchanged", async () => {
    const newTitle = "Only title updated";
    const patchReq = mkReq(`http://localhost/api/backoffice/content/pages/${PAGE_ID}`, {
      method: "PATCH",
      body: { title: newTitle, slug: "initial-slug" },
    });
    const patchRes = await PageByIdPATCH(patchReq, ctx);
    expect(patchRes.status).toBe(200);

    const getReq = mkReq(`http://localhost/api/backoffice/content/pages/${PAGE_ID}`);
    const getRes = await PageByIdGET(getReq, ctx);
    const getData = await readJson(getRes);
    expect(getData.data?.page?.title).toBe(newTitle);
    expect(getData.data?.page?.body?.blocks?.[0]?.data?.heading).toBe("Initial");
  });
});
