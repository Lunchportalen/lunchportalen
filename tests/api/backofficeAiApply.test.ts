/**
 * tests/api/backofficeAiApply.test.ts
 * AI apply (audit log) route: auth first, 500 when log insert fails (no silent drop).
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string, init?: RequestInit & { headers?: Record<string, string>; body?: unknown }) {
  const { headers = {}, body, ...rest } = init ?? {};
  const opts: RequestInit = { ...rest, headers: headers as HeadersInit };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    (opts as any).headers = { ...(opts.headers as any), "content-type": "application/json" };
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

const MOCK_RID = "rid_ai_apply";

const scopeOr401Mock = vi.fn();
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: (ctx: any, allowed: string[]) => {
    if (allowed?.includes?.("superadmin") && ctx?.scope?.role !== "superadmin") {
      return new Response(JSON.stringify({ ok: false, error: "FORBIDDEN", status: 403 }), { status: 403, headers: { "content-type": "application/json" } });
    }
    return null;
  },
}));

let applyLogInsertError: unknown = null;

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
          applyLogInsertError
            ? Promise.resolve({ data: null, error: applyLogInsertError })
            : Promise.resolve({ data: null, error: null }),
      };
    },
  }),
  };
});

import { POST as ApplyPOST } from "../../app/api/backoffice/ai/apply/route";

describe("Backoffice AI apply API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applyLogInsertError = null;
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/backoffice/ai/apply",
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
    const req = mkReq("http://localhost/api/backoffice/ai/apply", {
      method: "POST",
      body: { tool: "apply", patch: {} },
    });
    const res = await ApplyPOST(req);
    expect(res.status).toBe(401);
  });

  test("returns 500 when ai_activity_log insert fails (no silent drop)", async () => {
    applyLogInsertError = { message: "db error" };
    const req = mkReq("http://localhost/api/backoffice/ai/apply", {
      method: "POST",
      body: { tool: "seo.optimize.page", patch: {} },
    });
    const res = await ApplyPOST(req);
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("APPLY_LOG_FAILED");
  });

  test("returns 200 when log insert succeeds", async () => {
    const req = mkReq("http://localhost/api/backoffice/ai/apply", {
      method: "POST",
      body: { tool: "apply", patch: {} },
    });
    const res = await ApplyPOST(req);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.rid).toBe(MOCK_RID);
  });

  test("returns 200 for seo.optimize.page tool and patch (application safety / persistence path)", async () => {
    const req = mkReq("http://localhost/api/backoffice/ai/apply", {
      method: "POST",
      body: {
        tool: "seo.optimize.page",
        patch: { metaSuggestion: { title: "SEO title", description: "SEO desc" }, ops: [] },
      },
    });
    const res = await ApplyPOST(req);
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.rid).toBe(MOCK_RID);
  });

  test("returns 403 when role is company_admin (apply is superadmin-only)", async () => {
    scopeOr401Mock.mockResolvedValueOnce({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/backoffice/ai/apply",
        method: "POST",
        scope: { role: "company_admin", email: "admin@company.no" },
      },
    });
    const req = mkReq("http://localhost/api/backoffice/ai/apply", {
      method: "POST",
      body: { tool: "apply", patch: {} },
    });
    const res = await ApplyPOST(req);
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("FORBIDDEN");
  });
});
