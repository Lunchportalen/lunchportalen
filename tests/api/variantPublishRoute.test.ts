/**
 * Focused tests for /api/backoffice/content/pages/[id]/variant/publish
 * - Success path: returns ok:true when copyVariantBodyToProd succeeds.
 * - Failure path: returns 500 and ok:false when copyVariantBodyToProd throws.
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

const MOCK_RID = "rid_variant_publish";

const { scopeOr401Mock } = vi.hoisted(() => ({ scopeOr401Mock: vi.fn() }));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: vi.fn((ctx: any, roles: string[]) =>
    roles.includes(ctx?.scope?.role) ? null : new Response(JSON.stringify({ ok: false }), { status: 403 })
  ),
}));

const { copyVariantBodyToProdMock } = vi.hoisted(() => ({ copyVariantBodyToProdMock: vi.fn() }));

vi.mock("@/lib/backoffice/content/releasesRepo", () => ({
  copyVariantBodyToProd: (...args: any[]) => copyVariantBodyToProdMock(...args),
  getScheduledReleaseForVariant: vi.fn(async () => null),
}));

vi.mock("@/lib/backoffice/content/workflowRepo", () => ({
  getWorkflow: vi.fn(async () => ({ state: "approved" })),
  resetToDraftAfterPublish: vi.fn(async () => undefined),
}));

let mockVariantByIdAndPage: Record<string, { id: string; page_id: string } | null> = {};

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "content_page_variants") {
        const q: any = {
          _id: undefined as string | undefined,
          _pageId: undefined as string | undefined,
          select() {
            return q;
          },
          eq(col: string, val: string) {
            if (col === "id") q._id = val;
            if (col === "page_id") q._pageId = val;
            return q;
          },
          maybeSingle(): Promise<{ data: any; error: null }> {
            if (q._id && q._pageId) {
              const key = `${q._id}:${q._pageId}`;
              const row = mockVariantByIdAndPage[key] ?? null;
              return Promise.resolve({ data: row, error: null });
            }
            return Promise.resolve({ data: null, error: null });
          },
        };
        return q;
      }
      if (table === "content_audit_log") {
        const q: any = {
          insert() {
            return Promise.resolve({ data: null, error: null });
          },
        };
        return q;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { POST as VariantPublishPOST } from "../../app/api/backoffice/content/pages/[id]/variant/publish/route";

describe("POST /api/backoffice/content/pages/[id]/variant/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockVariantByIdAndPage = {};
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: MOCK_RID, scope: { role: "superadmin", email: "test@test.no" } },
    });
  });

  test("returns 200 and ok:true when copyVariantBodyToProd succeeds", async () => {
    const pageId = "page-1";
    const variantId = "v-1";
    mockVariantByIdAndPage[`${variantId}:${pageId}`] = { id: variantId, page_id: pageId };
    copyVariantBodyToProdMock.mockResolvedValueOnce(undefined);

    const req = mkReq(`http://localhost/api/backoffice/content/pages/${pageId}/variant/publish`, {
      method: "POST",
      body: { variantId, env: "prod", locale: "nb" },
    });
    const res = await VariantPublishPOST(req, { params: Promise.resolve({ id: pageId }) });
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.published ?? json.data?.published).toBe(true);
    expect(copyVariantBodyToProdMock).toHaveBeenCalledTimes(1);
  });

  test("returns 500 and ok:false when copyVariantBodyToProd throws (no false success)", async () => {
    const pageId = "page-2";
    const variantId = "v-2";
    mockVariantByIdAndPage[`${variantId}:${pageId}`] = { id: variantId, page_id: pageId };
    copyVariantBodyToProdMock.mockRejectedValueOnce(new Error("publish_failed"));

    const req = mkReq(`http://localhost/api/backoffice/content/pages/${pageId}/variant/publish`, {
      method: "POST",
      body: { variantId, env: "prod", locale: "nb" },
    });
    const res = await VariantPublishPOST(req, { params: Promise.resolve({ id: pageId }) });
    expect(res.status).toBe(500);
    const json = await readJson(res);
    expect(json.ok).toBe(false);
    expect(json.error ?? json.status).toBe("SERVER_ERROR");
    expect(String(json.message ?? json.detail ?? "")).toContain("publish_failed");
    expect(copyVariantBodyToProdMock).toHaveBeenCalledTimes(1);
  });
});

