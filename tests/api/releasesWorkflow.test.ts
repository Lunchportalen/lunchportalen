/**
 * tests/api/releasesWorkflow.test.ts
 * Release schedule and execute: auth gate and workflow state (draft → scheduled → execute).
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

const MOCK_RID = "rid_releases";

const { scopeOr401Mock } = vi.hoisted(() => ({ scopeOr401Mock: vi.fn() }));
vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: vi.fn(() => null),
}));

const releaseState = vi.hoisted(() => ({ release: null as { id: string; status: string } | null }));
vi.mock("@/lib/backoffice/content/releasesRepo", () => ({
  getRelease: vi.fn(async () => releaseState.release),
  updateReleaseStatus: vi.fn(async () => ({ error: null })),
  executeRelease: vi.fn(async () => ({ count: 1 })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  }),
}));

import { POST as SchedulePOST } from "../../app/api/backoffice/releases/[id]/schedule/route";
import { POST as ExecutePOST } from "../../app/api/backoffice/releases/[id]/execute/route";

describe("Releases schedule API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    releaseState.release = { id: "r1", status: "draft" };
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: MOCK_RID, scope: { role: "superadmin" } },
    });
  });

  test("POST returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({ ok: false, res: new Response(null, { status: 401 }) });
    const req = mkReq("http://localhost/api/backoffice/releases/r1/schedule", {
      method: "POST",
      body: { publish_at: new Date().toISOString() },
    });
    const res = await SchedulePOST(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(401);
  });

  test("POST returns 400 when release is not draft", async () => {
    releaseState.release = { id: "r1", status: "scheduled" };
    const req = mkReq("http://localhost/api/backoffice/releases/r1/schedule", {
      method: "POST",
      body: {},
    });
    const res = await SchedulePOST(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("BAD_REQUEST");
  });

  test("POST returns 200 when release is draft and publish_at provided (workflow: draft → scheduled)", async () => {
    releaseState.release = { id: "r1", status: "draft" };
    const publishAt = new Date(Date.now() + 86400000).toISOString();
    const req = mkReq("http://localhost/api/backoffice/releases/r1/schedule", {
      method: "POST",
      body: { publish_at: publishAt },
    });
    const res = await SchedulePOST(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.release ?? data.data?.release).toBeDefined();
  });
});

describe("Releases execute API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    releaseState.release = { id: "r1", status: "scheduled" };
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: MOCK_RID, scope: { role: "superadmin", email: "test@test.no" } },
    });
  });

  test("POST returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({ ok: false, res: new Response(null, { status: 401 }) });
    const req = mkReq("http://localhost/api/backoffice/releases/r1/execute", { method: "POST" });
    const res = await ExecutePOST(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(401);
  });

  test("POST returns 400 when release is not scheduled", async () => {
    releaseState.release = { id: "r1", status: "draft" };
    const req = mkReq("http://localhost/api/backoffice/releases/r1/execute", { method: "POST" });
    const res = await ExecutePOST(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("BAD_REQUEST");
  });

  test("POST returns 200 when release is scheduled (workflow: scheduled → execute)", async () => {
    releaseState.release = { id: "r1", status: "scheduled" };
    const req = mkReq("http://localhost/api/backoffice/releases/r1/execute", { method: "POST" });
    const res = await ExecutePOST(req, { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(200);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.count ?? data.data?.count).toBe(1);
  });
});
