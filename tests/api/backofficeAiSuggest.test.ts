/**
 * tests/api/backofficeAiSuggest.test.ts
 * AI suggest route: auth first, validation, no fake success (500 when insert fails).
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

const MOCK_RID = "rid_ai_suggest";

const { scopeOr401Mock, isAIEnabledMock, requireRoleOr403Mock } = vi.hoisted(() => ({
  scopeOr401Mock: vi.fn(),
  isAIEnabledMock: vi.fn(() => true),
  requireRoleOr403Mock: vi.fn(() => null),
}));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: (ctx: any, allowed: string[]) => {
    if (allowed?.includes?.("superadmin") && allowed.length === 1 && ctx?.scope?.role !== "superadmin") {
      return new Response(JSON.stringify({ ok: false, error: "FORBIDDEN", status: 403 }), { status: 403, headers: { "content-type": "application/json" } });
    }
    return requireRoleOr403Mock(ctx, allowed);
  },
}));

vi.mock("@/lib/ai/provider", () => ({
  isAIEnabled: () => isAIEnabledMock(),
  suggestJSON: vi.fn(),
}));

const supabaseState = vi.hoisted(() => ({
  suggestInsertError: null as { message: string } | null,
  suggestInsertData: { id: "sugg-123" } as { id: string } | null,
  activityLogInsertError: null as unknown,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "ai_suggestions") {
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                supabaseState.suggestInsertError
                  ? Promise.resolve({ data: null, error: supabaseState.suggestInsertError })
                  : Promise.resolve({
                      data: supabaseState.suggestInsertData ?? { id: "sugg-123" },
                      error: null,
                    }),
            }),
          }),
        };
      }
      if (table === "ai_activity_log") {
        return {
          insert: () =>
            supabaseState.activityLogInsertError
              ? Promise.resolve({ data: null, error: supabaseState.activityLogInsertError })
              : Promise.resolve({ data: null, error: null }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
}));

import { POST as SuggestPOST } from "../../app/api/backoffice/ai/suggest/route";

describe("Backoffice AI suggest API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireRoleOr403Mock.mockReturnValue(null);
    supabaseState.suggestInsertError = null;
    supabaseState.suggestInsertData = { id: "sugg-123" };
    supabaseState.activityLogInsertError = null;
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/backoffice/ai/suggest",
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
    const req = mkReq("http://localhost/api/backoffice/ai/suggest", {
      method: "POST",
      body: { tool: "landing.generate.sections", input: {}, existingBlocks: [] },
    });
    const res = await SuggestPOST(req);
    expect(res.status).toBe(401);
  });

  test("returns 400 when tool is missing", async () => {
    const req = mkReq("http://localhost/api/backoffice/ai/suggest", {
      method: "POST",
      body: { input: {} },
    });
    const res = await SuggestPOST(req);
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBeDefined();
  });

  test("returns 500 when ai_suggestions insert fails (no fake success)", async () => {
    supabaseState.suggestInsertError = { message: "db constraint" };
    const req = mkReq("http://localhost/api/backoffice/ai/suggest", {
      method: "POST",
      body: {
        tool: "landing.generate.sections",
        input: {},
        existingBlocks: [],
      },
    });
    const res = await SuggestPOST(req);
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("SUGGESTION_INSERT_FAILED");
  });

  test("returns 500 when ai_activity_log insert fails after suggestion saved", async () => {
    supabaseState.suggestInsertError = null;
    supabaseState.activityLogInsertError = { message: "log failed" };
    const req = mkReq("http://localhost/api/backoffice/ai/suggest", {
      method: "POST",
      body: {
        tool: "landing.generate.sections",
        input: {},
        existingBlocks: [],
      },
    });
    const res = await SuggestPOST(req);
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("SUGGESTION_LOG_FAILED");
  });

  test("returns 503 FEATURE_DISABLED when AI provider is unavailable (deterministic fallback)", async () => {
    isAIEnabledMock.mockReturnValueOnce(false);
    const req = mkReq("http://localhost/api/backoffice/ai/suggest", {
      method: "POST",
      body: {
        tool: "landing.generate.sections",
        input: {},
        existingBlocks: [],
      },
    });
    const res = await SuggestPOST(req);
    expect(res.status).toBe(503);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("FEATURE_DISABLED");
  });

  test("returns 403 when role is company_admin (suggest is superadmin-only)", async () => {
    scopeOr401Mock.mockResolvedValueOnce({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/backoffice/ai/suggest",
        method: "POST",
        scope: { role: "company_admin", email: "admin@company.no" },
      },
    });
    const req = mkReq("http://localhost/api/backoffice/ai/suggest", {
      method: "POST",
      body: { tool: "landing.generate.sections", input: {}, existingBlocks: [] },
    });
    const res = await SuggestPOST(req);
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data.ok).toBe(false);
    expect(data.error).toBe("FORBIDDEN");
  });
});
