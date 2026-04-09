/**
 * Backoffice experiments list + create API.
 * Auth, validation, create with status draft.
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

const MOCK_RID = "rid_experiments";

const { scopeOr401Mock, requireRoleOr403Mock } = vi.hoisted(() => ({
  scopeOr401Mock: vi.fn(),
  requireRoleOr403Mock: vi.fn(() => null),
}));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: (...args: unknown[]) => scopeOr401Mock(...args),
  requireRoleOr403: (...args: unknown[]) => requireRoleOr403Mock(...args),
  q: (req: Request, key: string) => {
    const u = new URL(req.url);
    return u.searchParams.get(key) ?? undefined;
  },
}));

const listRows: any[] = [];
let createError: Error | null = null;
let createRow: any = { id: "exp-row-1", experiment_id: "exp_1", status: "draft", name: "Test", type: "headline", page_id: "p1", config: { variants: [] }, created_at: "2025-01-01", updated_at: null };

const listThenable = {
  then: (resolve: (v: { data: any[]; error: null }) => void) => resolve({ data: listRows, error: null }),
  eq: () => listThenable,
};

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from: (table: string) => {
      if (table === "content_experiments") {
        return {
          select: () => ({
            order: () => listThenable,
            eq: () => listThenable,
          }),
          insert: () => ({
            select: () => ({
              single: () =>
                createError
                  ? Promise.resolve({ data: null, error: createError })
                  : Promise.resolve({ data: createRow, error: null }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
  };
});

import { GET as ExperimentsGET, POST as ExperimentsPOST } from "../../app/api/backoffice/experiments/route";

describe("Backoffice experiments API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listRows.length = 0;
    createError = null;
    createRow = { id: "exp-row-1", experiment_id: "exp_1", status: "draft", name: "Test", type: "headline", page_id: "p1", config: { variants: [] }, created_at: "2025-01-01", updated_at: null };
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: MOCK_RID, scope: { role: "superadmin", email: "test@test.no" } },
    });
    requireRoleOr403Mock.mockReturnValue(null);
  });

  test("GET returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({ ok: false, res: new Response(JSON.stringify({ ok: false }), { status: 401 }) });
    const res = await ExperimentsGET(mkReq("http://localhost/api/backoffice/experiments"));
    expect(res.status).toBe(401);
  });

  test("GET returns 200 and data array when authenticated", async () => {
    listRows.push({ id: "1", experiment_id: "exp_1", status: "draft", name: "E1", type: "headline", page_id: "p1", config: {}, created_at: "2025-01-01", updated_at: null });
    const res = await ExperimentsGET(mkReq("http://localhost/api/backoffice/experiments"));
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    const list = data.data?.data ?? data.data;
    expect(Array.isArray(list)).toBe(true);
  });

  test("POST returns 400 when page_id missing", async () => {
    const res = await ExperimentsPOST(mkReq("http://localhost/api/backoffice/experiments", {
      method: "POST",
      body: { name: "E1", type: "headline", config: { variants: [{ key: "A", label: "A" }, { key: "B", label: "B" }] } },
    }));
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBeDefined();
  });

  test("POST returns 400 when type invalid", async () => {
    const res = await ExperimentsPOST(mkReq("http://localhost/api/backoffice/experiments", {
      method: "POST",
      body: { page_id: "p1", name: "E1", type: "invalid", config: { variants: [{ key: "A", label: "A" }, { key: "B", label: "B" }] } },
    }));
    expect(res.status).toBe(400);
  });

  test("POST returns 400 when fewer than two variants", async () => {
    const res = await ExperimentsPOST(mkReq("http://localhost/api/backoffice/experiments", {
      method: "POST",
      body: { page_id: "p1", name: "E1", type: "headline", config: { variants: [{ key: "A", label: "A" }] } },
    }));
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBeDefined();
  });

  test("POST returns 201 and experiment with status draft when valid", async () => {
    const res = await ExperimentsPOST(mkReq("http://localhost/api/backoffice/experiments", {
      method: "POST",
      body: { page_id: "p1", name: "E1", type: "headline", config: { variants: [{ key: "A", label: "A" }, { key: "B", label: "B" }] } },
    }));
    expect(res.status).toBe(201);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    const row = data.data?.data ?? data.data;
    expect(row).toBeDefined();
    expect(row.status).toBe("draft");
  });
});
