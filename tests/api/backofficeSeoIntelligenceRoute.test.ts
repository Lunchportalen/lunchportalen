/**
 * SEO intelligence API: auth, body validation, 200 with structured result, 500 when log insert fails.
 * Deterministic tests; no snapshots.
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { body?: unknown }) {
  const { body, ...rest } = init ?? {};
  const opts: RequestInit = { ...rest };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    (opts as any).headers = { ...((opts.headers as any) ?? {}), "content-type": "application/json" };
  }
  return new Request(url, opts);
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

const MOCK_RID = "rid_seo_intelligence";

const { scopeOr401Mock, logInsertErrorRef } = vi.hoisted(() => ({
  scopeOr401Mock: vi.fn(),
  logInsertErrorRef: { current: null as unknown },
}));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: (ctx: any, allowed: string[]) => {
    if (allowed?.includes?.("superadmin") && ctx?.scope?.role !== "superadmin") {
      return new Response(JSON.stringify({ ok: false, error: "FORBIDDEN", status: 403 }), { status: 403, headers: { "content-type": "application/json" } });
    }
    return null;
  },
}));

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table !== "ai_activity_log") throw new Error(`Unexpected table: ${table}`);
      return {
        insert: () =>
          logInsertErrorRef.current
            ? Promise.resolve({ data: null, error: logInsertErrorRef.current })
            : Promise.resolve({ data: null, error: null }),
      };
    },
  }),
  };
});

vi.mock("@/lib/ops/log", () => ({ opsLog: vi.fn() }));

import { POST as SeoIntelligencePOST } from "../../app/api/backoffice/ai/seo-intelligence/route";

const validBody = {
  blocks: [{ id: "b1", type: "richText", data: { body: "Intro." } }],
  meta: { seo: { title: "Page Title", description: "Meta description." } },
  pageTitle: "Page",
  pageId: "page-1",
  locale: "nb",
  goal: "lead",
  brand: "Lunchportalen",
};

describe("Backoffice SEO intelligence API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    logInsertErrorRef.current = null;
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/backoffice/ai/seo-intelligence",
        method: "POST",
        scope: { role: "superadmin", email: "test@lunchportalen.no" },
      },
    });
  });

  test("returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false }), { status: 401 }),
    });
    const req = mkReq("http://localhost/api/backoffice/ai/seo-intelligence", { method: "POST", body: validBody });
    const res = await SeoIntelligencePOST(req);
    expect(res.status).toBe(401);
  });

  test("returns 400 when body is not an object", async () => {
    const req = mkReq("http://localhost/api/backoffice/ai/seo-intelligence", {
      method: "POST",
      body: "not json object",
      headers: { "Content-Type": "application/json" },
    });
    const res = await SeoIntelligencePOST(req);
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
  });

  test("returns 200 with ok and data containing score and suggestions when valid body and log succeeds", async () => {
    const req = mkReq("http://localhost/api/backoffice/ai/seo-intelligence", { method: "POST", body: validBody });
    const res = await SeoIntelligencePOST(req);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data).toBeDefined();
    expect(typeof data.data.score).toBe("number");
    expect(data.data.score).toBeGreaterThanOrEqual(0);
    expect(data.data.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(data.data.suggestions)).toBe(true);
    expect(typeof data.data.message).toBe("string");
  });

  test("returns 500 when ai_activity_log insert fails (no silent drop)", async () => {
    logInsertErrorRef.current = { message: "db error" };
    const req = mkReq("http://localhost/api/backoffice/ai/seo-intelligence", { method: "POST", body: validBody });
    const res = await SeoIntelligencePOST(req);
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("SEO_INTELLIGENCE_LOG_FAILED");
  });
});
