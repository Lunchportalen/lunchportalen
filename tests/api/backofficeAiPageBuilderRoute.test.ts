/**
 * Backoffice AI page-builder route:
 * - auth + role gate via routeGuard
 * - validates prompt
 * - fails closed on generatePageStructure errors
 */

// @ts-nocheck

import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(
  url: string,
  init?: RequestInit & { headers?: Record<string, string>; body?: unknown },
) {
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

const MOCK_RID = "rid_ai_page_builder";

const { scopeOr401Mock, requireRoleOr403Mock, readJsonMock } = vi.hoisted(() => ({
  scopeOr401Mock: vi.fn(),
  requireRoleOr403Mock: vi.fn(() => null),
  readJsonMock: vi.fn(),
}));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
  readJson: (...args: unknown[]) => readJsonMock(...args),
}));

const generatePageStructureMock = vi.fn();
const generatePageFromStructuredInputMock = vi.fn();
vi.mock("@/lib/ai/tools/pageBuilder", () => ({
  generatePageStructure: (...args: unknown[]) => generatePageStructureMock(...args),
  generatePageFromStructuredInput: (input: unknown) => generatePageFromStructuredInputMock(input),
}));

import { POST as PageBuilderPOST } from "../../app/api/backoffice/ai/page-builder/route";

describe("Backoffice AI page-builder API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/backoffice/ai/page-builder",
        method: "POST",
        scope: { role: "superadmin", email: "test@lunchportalen.no" },
      },
    });
    requireRoleOr403Mock.mockReturnValue(null);
    readJsonMock.mockResolvedValue({ prompt: "Lag en side", locale: "nb" });
    generatePageStructureMock.mockResolvedValue({
      title: "Ny side",
      summary: "Oppsummert",
      blocks: [{ type: "hero", data: { title: "T" } }],
      notes: [],
      warnings: [],
    });
  });

  test("returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false }), { status: 401 }),
    });
    const req = mkReq("http://localhost/api/backoffice/ai/page-builder", {
      method: "POST",
      body: { prompt: "x" },
    });
    const res = await PageBuilderPOST(req);
    expect(res.status).toBe(401);
  });

  test("returns 403 when role gate denies", async () => {
    requireRoleOr403Mock.mockReturnValue(
      new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), { status: 403 }),
    );
    const req = mkReq("http://localhost/api/backoffice/ai/page-builder", {
      method: "POST",
      body: { prompt: "x" },
    });
    const res = await PageBuilderPOST(req);
    expect(res.status).toBe(403);
  });

  test("returns 400 when prompt is missing", async () => {
    readJsonMock.mockResolvedValue({});
    const req = mkReq("http://localhost/api/backoffice/ai/page-builder", {
      method: "POST",
      body: {},
    });
    const res = await PageBuilderPOST(req);
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("BAD_REQUEST");
  });

  test("returns 500 when generatePageStructure throws", async () => {
    generatePageStructureMock.mockRejectedValueOnce(new Error("tool failed"));
    const req = mkReq("http://localhost/api/backoffice/ai/page-builder", {
      method: "POST",
      body: { prompt: "Lag en side" },
    });
    const res = await PageBuilderPOST(req);
    expect(res.status).toBe(500);
    const data = await readJson(res);
    expect(data.error).toBe("PAGE_BUILDER_FAILED");
  });

  test("returns 200 and ok:true for valid request (prompt only)", async () => {
    const req = mkReq("http://localhost/api/backoffice/ai/page-builder", {
      method: "POST",
      body: { prompt: "Lag en side", locale: "nb" },
    });
    const res = await PageBuilderPOST(req);
    expect(res.status).toBe(200);
    expect(generatePageStructureMock).toHaveBeenCalledTimes(1);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data?.title ?? data.title).toBe("Ny side");
    const blocks = data.data?.blocks ?? data.blocks;
    expect(Array.isArray(blocks)).toBe(true);
  });

  test("returns 200 for structured input (no prompt)", async () => {
    readJsonMock.mockResolvedValue({
      locale: "nb",
      goal: "lead",
      audience: "HR",
      pageType: "landing",
      ctaIntent: "demo",
    });
    generatePageFromStructuredInputMock.mockReturnValue({
      title: "Structured draft",
      summary: "Draft from structured intent.",
      blocks: [{ type: "hero", data: { title: "HR – lead" } }, { type: "cta", data: {} }],
    });
    const req = mkReq("http://localhost/api/backoffice/ai/page-builder", {
      method: "POST",
      body: { goal: "lead", audience: "HR", pageType: "landing", ctaIntent: "demo" },
    });
    const res = await PageBuilderPOST(req);
    expect(res.status).toBe(200);
    expect(generatePageFromStructuredInputMock).toHaveBeenCalledTimes(1);
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(Array.isArray(data.data?.blocks)).toBe(true);
  });
});

