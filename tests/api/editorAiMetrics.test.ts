/**
 * tests/api/editorAiMetrics.test.ts
 * API robustness: editor-ai metrics route — auth first, deterministic errors, canonical response shape.
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string>; body?: unknown }) {
  const { headers = {}, body, ...rest } = init ?? {};
  const opts: RequestInit = { ...rest, headers: headers as HeadersInit };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    (opts as any).headers = { ...headers, "content-type": "application/json" };
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

const MOCK_RID = "rid_editor_ai_metrics";

const { scopeOr401Mock } = vi.hoisted(() => ({ scopeOr401Mock: vi.fn() }));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: vi.fn(() => null),
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
        insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      };
    },
  }),
  };
});

import { POST as EditorAiMetricsPOST } from "../../app/api/editor-ai/metrics/route";

describe("Editor-AI metrics API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/editor-ai/metrics",
        method: "POST",
        scope: { role: "superadmin", email: "test@lunchportalen.no" },
      },
    });
  });

  test("returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, rid: MOCK_RID, message: "Ikke innlogget.", status: 401, error: "UNAUTHORIZED" }), { status: 401, headers: { "content-type": "application/json" } }),
      response: new Response(null, { status: 401 }),
      ctx: { rid: MOCK_RID, route: null, method: null, scope: {} },
    });
    const req = mkReq("http://localhost/api/editor-ai/metrics", { method: "POST", body: { type: "editor_opened", timestamp: new Date().toISOString() } });
    const res = await EditorAiMetricsPOST(req);
    expect(res.status).toBe(401);
    const data = await readJson(res);
    expect(data).toMatchObject({ ok: false, error: "UNAUTHORIZED" });
  });

  test("returns 400 when body is not an object", async () => {
    const req = mkReq("http://localhost/api/editor-ai/metrics", { method: "POST", body: "not json object" });
    const res = await EditorAiMetricsPOST(req);
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data).toMatchObject({ ok: false, error: "invalid_body" });
    expect(data.rid).toBe(MOCK_RID);
  });

  test("returns 400 when type is missing", async () => {
    const req = mkReq("http://localhost/api/editor-ai/metrics", { method: "POST", body: { timestamp: new Date().toISOString() } });
    const res = await EditorAiMetricsPOST(req);
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data).toMatchObject({ ok: false, error: "missing_type" });
  });

  test("returns 200 and ok: true with valid body (auth first, then validation)", async () => {
    const req = mkReq("http://localhost/api/editor-ai/metrics", {
      method: "POST",
      body: { type: "editor_opened", timestamp: new Date().toISOString() },
    });
    const res = await EditorAiMetricsPOST(req);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data).toMatchObject({ ok: true, rid: MOCK_RID });
    expect(data.data).toEqual({ ok: true });
  });

  test("accepts events with layout_suggestions and image_generate feature (observability parity)", async () => {
    const ts = new Date().toISOString();
    const req1 = mkReq("http://localhost/api/editor-ai/metrics", {
      method: "POST",
      body: { type: "ai_action_triggered", timestamp: ts, feature: "layout_suggestions", pageId: "p1" },
    });
    const res1 = await EditorAiMetricsPOST(req1);
    expect(res1.status).toBe(200);

    const req2 = mkReq("http://localhost/api/editor-ai/metrics", {
      method: "POST",
      body: { type: "ai_patch_applied", timestamp: ts, feature: "image_generate", pageId: "p2" },
    });
    const res2 = await EditorAiMetricsPOST(req2);
    expect(res2.status).toBe(200);
  });

  test("accepts all workflow event types (trigger, result, apply, error) for observability", async () => {
    const ts = new Date().toISOString();
    const events = [
      { type: "ai_action_triggered", feature: "improve_page", pageId: "p1" },
      { type: "ai_result_received", feature: "seo_optimize", pageId: "p1", patchPresent: true },
      { type: "ai_patch_applied", feature: "block_builder", pageId: "p1" },
      { type: "ai_error", message: "Network error", kind: "network", pageId: null },
    ];
    for (const evt of events) {
      const req = mkReq("http://localhost/api/editor-ai/metrics", {
        method: "POST",
        body: { ...evt, timestamp: ts },
      });
      const res = await EditorAiMetricsPOST(req);
      expect(res.status).toBe(200);
    }
  });

  test("accepts CRO observability events (analysis, apply, dismiss, error)", async () => {
    const ts = new Date().toISOString();
    const events = [
      { type: "ai_action_triggered", feature: "cro_analysis", pageId: "p1" },
      { type: "ai_result_received", feature: "cro_analysis", pageId: "p1", patchPresent: true },
      { type: "ai_patch_applied", feature: "cro_apply", pageId: "p1" },
      { type: "ai_action_triggered", feature: "cro_dismiss", pageId: "p1" },
      { type: "ai_error", feature: "cro_apply", message: "Trust signals already set", kind: "apply", pageId: "p1" },
    ];
    for (const evt of events) {
      const req = mkReq("http://localhost/api/editor-ai/metrics", {
        method: "POST",
        body: { ...evt, timestamp: ts },
      });
      const res = await EditorAiMetricsPOST(req);
      expect(res.status).toBe(200);
    }
  });

  test("CRO event payloads have required shape (type, feature, timestamp)", async () => {
    const ts = new Date().toISOString();
    const req = mkReq("http://localhost/api/editor-ai/metrics", {
      method: "POST",
      body: { type: "ai_result_received", feature: "cro_analysis", pageId: "p1", patchPresent: true, timestamp: ts },
    });
    const res = await EditorAiMetricsPOST(req);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data).toMatchObject({ ok: true });
  });

  test("unauthorized CRO AI access is denied: 401 for CRO events when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, rid: MOCK_RID, message: "Ikke innlogget.", status: 401, error: "UNAUTHORIZED" }), { status: 401, headers: { "content-type": "application/json" } }),
      response: new Response(null, { status: 401 }),
      ctx: { rid: MOCK_RID, route: null, method: null, scope: {} },
    });
    const req = mkReq("http://localhost/api/editor-ai/metrics", {
      method: "POST",
      body: { type: "ai_action_triggered", feature: "cro_analysis", pageId: "p1", timestamp: new Date().toISOString() },
    });
    const res = await EditorAiMetricsPOST(req);
    expect(res.status).toBe(401);
    const data = await readJson(res);
    expect(data).toMatchObject({ ok: false, error: "UNAUTHORIZED" });
  });
});
