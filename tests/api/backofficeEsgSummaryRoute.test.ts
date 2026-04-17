/**
 * Backoffice ESG summary: superadmin-only, requires company_id, returns snapshot envelope.
 */
// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

import { GET as EsgSummaryGET } from "../../app/api/backoffice/esg/summary/route";

const { scopeOr401Mock, fetchSnapshotMock } = vi.hoisted(() => ({
  scopeOr401Mock: vi.fn(),
  fetchSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: (ctx: any, allowed: string[]) => {
    if (allowed?.includes?.("superadmin") && ctx?.scope?.role !== "superadmin") {
      return new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    return null;
  },
  denyResponse: (s: any) => s?.res ?? new Response(null, { status: 401 }),
}));

vi.mock("@/lib/esg/fetchCompanyEsgSnapshotSummary", () => ({
  fetchCompanyEsgSnapshotSummary: (...args: unknown[]) => fetchSnapshotMock(...args),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: vi.fn(async () => ({})),
}));

describe("GET /api/backoffice/esg/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "rid_test", scope: { role: "superadmin" }, route: "/api/backoffice/esg/summary" },
    });
    fetchSnapshotMock.mockResolvedValue({
      year: 2026,
      months: [],
      yearly: null,
    });
  });

  test("400 when company_id mangler", async () => {
    const req = new Request("http://localhost/api/backoffice/esg/summary");
    const res = await EsgSummaryGET(req);
    expect(res.status).toBe(400);
  });

  test("200 med data når snapshot finnes", async () => {
    const req = new Request("http://localhost/api/backoffice/esg/summary?company_id=00000000-0000-0000-0000-000000000001");
    const res = await EsgSummaryGET(req);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(j.data.company_id).toBe("00000000-0000-0000-0000-000000000001");
    expect(j.data.year).toBe(2026);
  });
});
