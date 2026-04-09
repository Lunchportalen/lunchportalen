/**
 * Backoffice experiment by id: GET + PATCH.
 * Status transitions: active sets started_at, completed sets completed_at.
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

const MOCK_RID = "rid_experiment_id";

const { scopeOr401Mock, requireRoleOr403Mock } = vi.hoisted(() => ({
  scopeOr401Mock: vi.fn(),
  requireRoleOr403Mock: vi.fn(() => null),
}));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: (...args: unknown[]) => scopeOr401Mock(...args),
  requireRoleOr403: (...args: unknown[]) => requireRoleOr403Mock(...args),
}));

let getByIdRow: any = { id: "exp-1", experiment_id: "exp_1", status: "draft", name: "E1", type: "headline", page_id: "p1", config: { variants: [] }, created_at: "2025-01-01", updated_at: null, started_at: null, completed_at: null };
let updateResult: any = { ...getByIdRow };
let getStatsResult = { views: 0, clicks: 0, conversions: 0, variants: [], byVariant: [] };

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
            eq: (_: string, id: string) => ({
              maybeSingle: () => Promise.resolve({ data: getByIdRow, error: null }),
              single: () => Promise.resolve({ data: updateResult, error: null }),
            }),
            order: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) }),
          }),
          update: (payload: any) => ({
            eq: () => ({
              select: () => ({
                single: () => {
                  updateResult = { ...getByIdRow, ...payload };
                  return Promise.resolve({ data: updateResult, error: null });
                },
              }),
            }),
          }),
        };
      }
      if (table === "experiment_results") {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: getStatsResult.byVariant ?? [], error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  }),
  };
});

vi.mock("@/lib/ai/experiments/analytics", () => ({
  getExperimentStats: () => Promise.resolve(getStatsResult),
}));

import { GET as ExperimentByIdGET, PATCH as ExperimentByIdPATCH } from "../../app/api/backoffice/experiments/[id]/route";

describe("Backoffice experiment [id] API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getByIdRow = { id: "exp-1", experiment_id: "exp_1", status: "draft", name: "E1", type: "headline", page_id: "p1", config: { variants: [] }, created_at: "2025-01-01", updated_at: null, started_at: null, completed_at: null };
    updateResult = { ...getByIdRow };
    getStatsResult = { views: 0, clicks: 0, conversions: 0, variants: [], byVariant: [] };
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: MOCK_RID, scope: { role: "superadmin" } },
    });
    requireRoleOr403Mock.mockReturnValue(null);
  });

  test("GET returns 404 when experiment not found", async () => {
    getByIdRow = null;
    const res = await ExperimentByIdGET(mkReq("http://localhost/api/backoffice/experiments/exp-1"), { params: Promise.resolve({ id: "exp-1" }) });
    expect(res.status).toBe(404);
    const data = await readJson(res);
    expect(data.error).toBeDefined();
  });

  test("GET returns 200 and data with stats when found", async () => {
    const res = await ExperimentByIdGET(mkReq("http://localhost/api/backoffice/experiments/exp-1"), { params: Promise.resolve({ id: "exp-1" }) });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    const detail = data.data?.data ?? data.data;
    expect(detail).toBeDefined();
    expect(detail.stats).toBeDefined();
    expect(detail.stats.views).toBe(0);
    expect(detail.stats.byVariant).toBeDefined();
  });

  test("PATCH returns 400 when no valid fields", async () => {
    const res = await ExperimentByIdPATCH(mkReq("http://localhost/api/backoffice/experiments/exp-1", { method: "PATCH", body: {} }), { params: Promise.resolve({ id: "exp-1" }) });
    expect(res.status).toBe(400);
  });

  test("PATCH status to active returns 200 and sets started_at", async () => {
    const res = await ExperimentByIdPATCH(
      mkReq("http://localhost/api/backoffice/experiments/exp-1", { method: "PATCH", body: { status: "active" } }),
      { params: Promise.resolve({ id: "exp-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    const row = data.data?.data ?? data.data;
    expect(row?.status).toBe("active");
    expect(row?.started_at).toBeDefined();
  });

  test("PATCH status to completed returns 200 and sets completed_at", async () => {
    const res = await ExperimentByIdPATCH(
      mkReq("http://localhost/api/backoffice/experiments/exp-1", { method: "PATCH", body: { status: "completed" } }),
      { params: Promise.resolve({ id: "exp-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    const row = data.data?.data ?? data.data;
    expect(row?.status).toBe("completed");
    expect(row?.completed_at).toBeDefined();
  });
});