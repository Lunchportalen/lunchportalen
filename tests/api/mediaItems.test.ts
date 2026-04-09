// tests/api/mediaItems.test.ts
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

const MOCK_RID = "rid_media_test";

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: vi.fn(async () => ({
    ok: true,
    ctx: {
      rid: MOCK_RID,
      route: "/api/backoffice/media/items",
      method: "GET",
      scope: { role: "superadmin", email: "test@lunchportalen.no" },
    },
  })),
  requireRoleOr403: vi.fn(() => null),
  denyResponse: vi.fn((s: any) =>
    s?.ok === false && s?.res ? s.res : new Response(JSON.stringify({ ok: false }), { status: 401 })
  ),
  q: vi.fn(() => null),
}));

let mockMediaRows: Array<any> = [];

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "media_items") {
        throw new Error(`Unexpected table: ${table}`);
      }

      const q: any = {
        _insertPayload: null as Record<string, unknown> | null,
        select(_cols?: string) {
          return q;
        },
        order(_col?: string, _opts?: any) {
          return q;
        },
        limit(_n: number) {
          return q;
        },
        range(_from: number, _to: number) {
          return q;
        },
        eq(_col: string, _val: any) {
          return q;
        },
        insert(payload: Record<string, unknown>) {
          q._insertPayload = payload;
          return q;
        },
        single() {
          if (q._insertPayload != null) {
            const row = {
              id: "gen-uuid-post-" + Date.now(),
              type: q._insertPayload.type ?? "image",
              status: q._insertPayload.status ?? "ready",
              source: q._insertPayload.source ?? "upload",
              url: q._insertPayload.url ?? "",
              alt: q._insertPayload.alt ?? "",
              caption: q._insertPayload.caption ?? null,
              width: null,
              height: null,
              mime_type: null,
              bytes: null,
              tags: q._insertPayload.tags ?? [],
              metadata: q._insertPayload.metadata ?? {},
              created_by: q._insertPayload.created_by ?? null,
              created_at: new Date().toISOString(),
            };
            return Promise.resolve({ data: row, error: null });
          }
          return Promise.resolve({ data: null, error: null });
        },
        then(resolve: (value: { data: any; error: any }) => void) {
          resolve({ data: mockMediaRows, error: null });
        },
      };

      return q;
    },
  }),
  };
});

import { GET as MediaListGET, POST as MediaListPOST } from "../../app/api/backoffice/media/items/route";

describe("Backoffice media items API", () => {
  beforeEach(() => {
    mockMediaRows = [];
    vi.clearAllMocks();
  });

  test("GET /api/backoffice/media/items returns list of ready media with url", async () => {
    mockMediaRows = [
      {
        id: "m1",
        type: "image",
        status: "ready",
        source: "upload",
        url: "https://cdn.test/image1.jpg",
        alt: "Alt 1",
        caption: null,
        width: 1200,
        height: 800,
        mime_type: "image/jpeg",
        bytes: 12345,
        tags: ["hero"],
        metadata: {},
        created_by: "test@lunchportalen.no",
        created_at: "2026-03-11T12:00:00Z",
      },
      {
        id: "m2",
        type: "image",
        status: "ready",
        source: "upload",
        url: "",
        alt: "Missing url",
        caption: null,
        width: null,
        height: null,
        mime_type: null,
        bytes: null,
        tags: [],
        metadata: {},
        created_by: "test@lunchportalen.no",
        created_at: "2026-03-11T12:00:00Z",
      },
    ];

    const req = mkReq("http://localhost/api/backoffice/media/items", { method: "GET" });
    const res = await MediaListGET(req);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    const items = json.data?.items ?? json.items ?? [];
    expect(items.length).toBe(1);
    expect(items[0].id).toBe("m1");
    expect(items[0].url).toBe("https://cdn.test/image1.jpg");
  });

  test("GET returns items with id, url and alt for editor media picker integration", async () => {
    mockMediaRows = [
      {
        id: "picker-1",
        type: "image",
        status: "ready",
        source: "upload",
        url: "https://cdn.test/picker.jpg",
        alt: "Alt for picker",
        caption: null,
        width: 800,
        height: 600,
        mime_type: "image/jpeg",
        bytes: 1024,
        tags: [],
        metadata: {},
        created_by: "test@test.no",
        created_at: "2026-03-11T12:00:00Z",
      },
    ];

    const req = mkReq("http://localhost/api/backoffice/media/items", { method: "GET" });
    const res = await MediaListGET(req);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    const items = json.data?.items ?? json.items ?? [];
    expect(items.length).toBe(1);
    expect(items[0]).toMatchObject({
      id: "picker-1",
      url: "https://cdn.test/picker.jpg",
      alt: "Alt for picker",
    });
  });

  test("POST /api/backoffice/media/items creates item and returns 200 with item.url", async () => {
    const req = mkReq("http://localhost/api/backoffice/media/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://cdn.example.com/hero.jpg",
        alt: "Hero bilde",
        tags: ["hero"],
      }),
    });
    const res = await MediaListPOST(req);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    const item = json.data?.item ?? json.item;
    expect(item).toBeDefined();
    expect(typeof item.url).toBe("string");
    expect(item.url.trim()).toBe("https://cdn.example.com/hero.jpg");
    expect(item.alt).toBe("Hero bilde");
    expect(item.id).toBeDefined();
  });

  test("POST /api/backoffice/media/items returns 400 when url missing", async () => {
    const req = mkReq("http://localhost/api/backoffice/media/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ alt: "No url" }),
    });
    const res = await MediaListPOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("POST /api/backoffice/media/items returns 400 when url is not http(s)", async () => {
    const req = mkReq("http://localhost/api/backoffice/media/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "javascript:alert(1)" }),
    });
    const res = await MediaListPOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("POST /api/backoffice/media/items returns 400 when alt exceeds max length", async () => {
    const req = mkReq("http://localhost/api/backoffice/media/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://cdn.example.com/img.jpg",
        alt: "a".repeat(181),
      }),
    });
    const res = await MediaListPOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("POST /api/backoffice/media/items returns 400 when caption exceeds max length", async () => {
    const req = mkReq("http://localhost/api/backoffice/media/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://cdn.example.com/img.jpg",
        caption: "c".repeat(501),
      }),
    });
    const res = await MediaListPOST(req);
    expect(res.status).toBe(400);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
  });

  test("GET returns 401 when scopeOr401 returns ok false (unauthorized)", async () => {
    const { scopeOr401 } = await import("@/lib/http/routeGuard");
    vi.mocked(scopeOr401).mockResolvedValueOnce({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), { status: 401 }),
      response: new Response(null, { status: 401 }),
      ctx: { rid: MOCK_RID, route: "/api/backoffice/media/items", method: "GET", scope: {} },
    });
    const req = mkReq("http://localhost/api/backoffice/media/items", { method: "GET" });
    const res = await MediaListGET(req);
    expect(res.status).toBe(401);
  });

  test("GET returns 403 when requireRoleOr403 denies (forbidden)", async () => {
    const { requireRoleOr403 } = await import("@/lib/http/routeGuard");
    vi.mocked(requireRoleOr403).mockReturnValueOnce(
      new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), { status: 403 })
    );
    const req = mkReq("http://localhost/api/backoffice/media/items", { method: "GET" });
    const res = await MediaListGET(req);
    expect(res.status).toBe(403);
  });
});

