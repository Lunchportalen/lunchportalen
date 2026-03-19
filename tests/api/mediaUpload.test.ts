// tests/api/mediaUpload.test.ts
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

const MOCK_RID = "rid_media_upload_test";

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: vi.fn(async () => ({
    ok: true,
    ctx: {
      rid: MOCK_RID,
      route: "/api/backoffice/media/upload",
      method: "POST",
      scope: { role: "superadmin", email: "test@lunchportalen.no" },
    },
  })),
  requireRoleOr403: vi.fn(() => null),
  denyResponse: vi.fn((s: any) =>
    s?.ok === false && s?.res ? s.res : new Response(JSON.stringify({ ok: false }), { status: 401 })
  ),
}));

let mockUploadResult: { error: any } = { error: null };
let mockInsertedRow: any = null;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    storage: {
      from: (bucket: string) => ({
        upload: async (_path: string, _file: Blob, _opts: any) => mockUploadResult,
        getPublicUrl: (_path: string) => ({
          data: { publicUrl: "https://cdn.test/uploaded.jpg" },
        }),
      }),
    },
    from: (table: string) => {
      if (table !== "media_items") throw new Error(`Unexpected table: ${table}`);
      const q: any = {
        _insertPayload: null,
        insert(payload: any) {
          q._insertPayload = payload;
          return q;
        },
        select(_cols?: string) {
          return q;
        },
        single() {
          mockInsertedRow = {
            id: "upload-uuid-1",
            type: "image",
            status: q._insertPayload.status ?? "ready",
            source: q._insertPayload.source ?? "upload",
            url: q._insertPayload.url ?? "https://cdn.test/uploaded.jpg",
            alt: q._insertPayload.alt ?? "",
            caption: q._insertPayload.caption ?? null,
            width: null,
            height: null,
            mime_type: q._insertPayload.mime_type ?? "image/jpeg",
            bytes: q._insertPayload.bytes ?? 1234,
            tags: q._insertPayload.tags ?? [],
            metadata: q._insertPayload.metadata ?? {},
            created_by: q._insertPayload.created_by ?? null,
            created_at: new Date().toISOString(),
          };
          return Promise.resolve({ data: mockInsertedRow, error: null });
        },
      };
      return q;
    },
  }),
  hasSupabaseAdminConfig: () => true,
}));

// Minimal validation stub (reuses real implementation in route via dynamic import)
vi.mock("@/lib/media/validation", async () => {
  const actual = await vi.importActual<any>("@/lib/media/validation");
  return {
    ...actual,
    validateMediaUrl: (url: string) => actual.validateMediaUrl(url),
  };
});

import { POST as MediaUploadPOST } from "../../app/api/backoffice/media/upload/route";

describe("Backoffice media upload API", () => {
  beforeEach(() => {
    mockUploadResult = { error: null };
    mockInsertedRow = null;
    vi.clearAllMocks();
  });

  test("POST /api/backoffice/media/upload uploads file and creates media_items row", async () => {
    const blob = new Blob(["fake-image-bytes"], { type: "image/jpeg" });
    const file = new File([blob], "hero.jpg", { type: "image/jpeg" });
    const form = new FormData();
    form.append("file", file);
    form.append("alt", "Hero bildefil");
    form.append("tags", "hero, front");

    const req = mkReq("http://localhost/api/backoffice/media/upload", {
      method: "POST",
      body: form as any,
    });
    const res = await MediaUploadPOST(req);
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    const item = json.data?.item ?? json.item;
    expect(item).toBeDefined();
    expect(item.url).toBe("https://cdn.test/uploaded.jpg");
    expect(item.alt).toBe("Hero bildefil");
    expect(item.id).toBe("upload-uuid-1");
  });
});

