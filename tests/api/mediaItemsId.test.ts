// tests/api/mediaItemsId.test.ts — GET and PATCH /api/backoffice/media/items/:id
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

const MOCK_RID = "rid_media_id_test";

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: vi.fn(async () => ({
    ok: true,
    ctx: {
      rid: MOCK_RID,
      route: "/api/backoffice/media/items/[id]",
      method: "GET",
      scope: { role: "superadmin", email: "test@lunchportalen.no" },
    },
  })),
  requireRoleOr403: vi.fn(() => null),
  denyResponse: vi.fn((s: { res?: Response; response?: Response }) => s?.res ?? s?.response ?? new Response(JSON.stringify({ ok: false }), { status: 401 })),
  q: vi.fn(() => null),
}));

// Single-item lookup/update: by id. GET uses select().eq("id", id).maybeSingle(); PATCH uses select+maybeSingle then update+eq+select+single.
let mockItemById: Record<string, Record<string, unknown> | null> = {};

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "media_items") throw new Error(`Unexpected table: ${table}`);

      const q: any = {
        _id: undefined as string | undefined,
        _updates: undefined as Record<string, unknown> | undefined,
        select(_cols?: string | string[]) {
          return q;
        },
        eq(col: string, val: string) {
          if (col === "id") q._id = val;
          return q;
        },
        update(updates: Record<string, unknown>) {
          q._updates = updates;
          return q;
        },
        delete() {
          const qb = q;
          return {
            eq(col: string, val: string) {
              if (col === "id") qb._id = val;
              return {
                then(resolve: (value: { error: null }) => void) {
                  if (qb._id != null) delete mockItemById[qb._id];
                  resolve({ error: null });
                },
              };
            },
          };
        },
        maybeSingle() {
          const id = q._id;
          const row = id != null ? mockItemById[id] ?? null : null;
          return Promise.resolve({ data: row, error: null });
        },
        single() {
          const id = q._id;
          if (q._updates != null) {
            const existing = id != null ? mockItemById[id] : null;
            if (!existing) return Promise.resolve({ data: null, error: { message: "not found" } });
            const merged = { ...existing, ...q._updates };
            mockItemById[id!] = merged;
            return Promise.resolve({ data: merged, error: null });
          }
          const row = id != null ? mockItemById[id] ?? null : null;
          return row
            ? Promise.resolve({ data: row, error: null })
            : Promise.resolve({ data: null, error: { message: "not found" } });
        },
        order() {
          return q;
        },
        limit() {
          return q;
        },
        then(resolve: (value: { data: any; error: any }) => void) {
          return q.maybeSingle().then(resolve);
        },
      };

      return q;
    },
  }),
  };
});

import { GET as MediaItemGET, PATCH as MediaItemPATCH, DELETE as MediaItemDELETE } from "../../app/api/backoffice/media/items/[id]/route";

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-345678901234";
const OTHER_UUID = "b2c3d4e5-f6a7-4890-b123-456789012345";
const NON_EXISTENT_UUID = "c3d4e5f6-a7b8-4901-c234-567890123456";

describe("Backoffice media items [id] API", () => {
  beforeEach(() => {
    mockItemById = {};
    vi.clearAllMocks();
  });

  test("GET /api/backoffice/media/items/:id returns item with alt when found", async () => {
    const id = VALID_UUID;
    mockItemById[id] = {
      id,
      type: "image",
      status: "ready",
      source: "upload",
      url: "https://cdn.test/img.jpg",
      alt: "Bilde av lunsj",
      caption: null,
      width: 800,
      height: 600,
      mime_type: "image/jpeg",
      bytes: 1024,
      tags: [],
      metadata: {},
      created_by: "test@test.no",
      created_at: "2026-03-11T12:00:00Z",
    };

    const req = mkReq(`http://localhost/api/backoffice/media/items/${id}`, { method: "GET" });
    const res = await MediaItemGET(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data?.item).toBeDefined();
    expect(json.data.item.alt).toBe("Bilde av lunsj");
    expect(json.data.item.id).toBe(id);
  });

  test("GET /api/backoffice/media/items/:id returns 404 when item not found", async () => {
    const id = NON_EXISTENT_UUID;
    mockItemById[id] = null;

    const req = mkReq(`http://localhost/api/backoffice/media/items/${id}`, { method: "GET" });
    const res = await MediaItemGET(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("GET /api/backoffice/media/items/:id returns 400 when id empty", async () => {
    const req = mkReq("http://localhost/api/backoffice/media/items/ ", { method: "GET" });
    const res = await MediaItemGET(req, { params: Promise.resolve({ id: " " }) });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("GET /api/backoffice/media/items/:id returns 400 when id is not a valid UUID", async () => {
    const req = mkReq("http://localhost/api/backoffice/media/items/not-a-uuid", { method: "GET" });
    const res = await MediaItemGET(req, { params: Promise.resolve({ id: "not-a-uuid" }) });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("PATCH /api/backoffice/media/items/:id updates alt and returns item", async () => {
    const id = VALID_UUID;
    mockItemById[id] = {
      id,
      type: "image",
      status: "ready",
      source: "upload",
      url: "https://cdn.test/patch.jpg",
      alt: "Old alt",
      caption: null,
      width: 800,
      height: 600,
      mime_type: "image/jpeg",
      bytes: 1024,
      tags: [],
      metadata: {},
      created_by: "test@test.no",
      created_at: "2026-03-11T12:00:00Z",
    };

    const req = mkReq(`http://localhost/api/backoffice/media/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: "New alt from editor" }),
    });
    const res = await MediaItemPATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data?.item).toBeDefined();
    expect(json.data.item.alt).toBe("New alt from editor");
  });

  test("PATCH /api/backoffice/media/items/:id returns 400 when no fields to update", async () => {
    const id = OTHER_UUID;
    mockItemById[id] = {
      id,
      type: "image",
      status: "ready",
      url: "https://cdn.test/x.jpg",
      alt: "A",
      caption: null,
      tags: [],
      metadata: {},
    };

    const req = mkReq(`http://localhost/api/backoffice/media/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await MediaItemPATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("PATCH /api/backoffice/media/items/:id returns 404 when item not found", async () => {
    const id = NON_EXISTENT_UUID;
    mockItemById[id] = null;

    const req = mkReq(`http://localhost/api/backoffice/media/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: "New" }),
    });
    const res = await MediaItemPATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(404);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("PATCH /api/backoffice/media/items/:id updates caption for editor integration", async () => {
    const id = VALID_UUID;
    mockItemById[id] = {
      id,
      type: "image",
      status: "ready",
      source: "upload",
      url: "https://cdn.test/cap.jpg",
      alt: "Alt",
      caption: null,
      tags: [],
      metadata: {},
    };

    const req = mkReq(`http://localhost/api/backoffice/media/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caption: "Bildetekst fra redaktør" }),
    });
    const res = await MediaItemPATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data?.item?.caption).toBe("Bildetekst fra redaktør");
  });

  test("DELETE /api/backoffice/media/items/:id returns 200 and deletes item", async () => {
    const id = VALID_UUID;
    mockItemById[id] = {
      id,
      type: "image",
      status: "ready",
      source: "upload",
      url: "https://cdn.test/delete-me.jpg",
      alt: "",
      caption: null,
      tags: [],
      metadata: {},
    };

    const req = mkReq(`http://localhost/api/backoffice/media/items/${id}`, { method: "DELETE" });
    const res = await MediaItemDELETE(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data?.deleted).toBe(true);
    expect(mockItemById[id]).toBeUndefined();
  });

  test("DELETE /api/backoffice/media/items/:id returns 400 when id empty", async () => {
    const req = mkReq("http://localhost/api/backoffice/media/items/ ", { method: "DELETE" });
    const res = await MediaItemDELETE(req, { params: Promise.resolve({ id: " " }) });
    expect(res.status).toBe(400);
  });

  test("PATCH /api/backoffice/media/items/:id merges displayName into metadata", async () => {
    const id = VALID_UUID;
    mockItemById[id] = {
      id,
      type: "image",
      status: "ready",
      source: "upload",
      url: "https://cdn.test/dn.jpg",
      alt: "A",
      caption: null,
      tags: [],
      metadata: { foo: "bar" },
    };

    const req = mkReq(`http://localhost/api/backoffice/media/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Bibliotek-navn" }),
    });
    const res = await MediaItemPATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.data?.item?.metadata?.displayName).toBe("Bibliotek-navn");
    expect(json.data?.item?.metadata?.foo).toBe("bar");
  });

  test("PATCH /api/backoffice/media/items/:id normalizes metadata.variants", async () => {
    const id = VALID_UUID;
    mockItemById[id] = {
      id,
      type: "image",
      status: "ready",
      url: "https://cdn.test/v.jpg",
      alt: "",
      caption: null,
      tags: [],
      metadata: {},
    };

    const req = mkReq(`http://localhost/api/backoffice/media/items/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metadata: {
          variants: {
            w640: "https://cdn.test/w640.jpg",
            bad: "javascript:void(0)",
          },
        },
      }),
    });
    const res = await MediaItemPATCH(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.data?.item?.metadata?.variants?.w640).toBe("https://cdn.test/w640.jpg");
    expect(json.data?.item?.metadata?.variants?.bad).toBeUndefined();
  });
});
