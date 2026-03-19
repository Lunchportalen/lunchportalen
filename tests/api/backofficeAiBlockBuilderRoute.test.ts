/**
 * Backoffice AI block-builder route:
 * - auth + role gate via routeGuard
 * - respects isAIEnabled (503 when disabled)
 * - validates body and description
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

const MOCK_RID = "rid_ai_block_builder";

const { scopeOr401Mock, requireRoleOr403Mock, isAIEnabledMock } = vi.hoisted(() => ({
  scopeOr401Mock: vi.fn(),
  requireRoleOr403Mock: vi.fn(() => null),
  isAIEnabledMock: vi.fn(() => true),
}));

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: requireRoleOr403Mock,
}));

vi.mock("@/lib/ai/provider", () => ({
  isAIEnabled: isAIEnabledMock,
}));

const buildBlockFromDescriptionMock = vi.fn(() => ({
  block: { id: "b1", type: "hero", data: { title: "T" } },
  message: "ok",
}));
vi.mock("@/lib/ai/tools/blockBuilder", () => ({
  buildBlockFromDescription: (...args: unknown[]) => buildBlockFromDescriptionMock(...args),
}));

import { POST as BlockBuilderPOST } from "../../app/api/backoffice/ai/block-builder/route";

describe("Backoffice AI block-builder API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isAIEnabledMock.mockReturnValue(true);
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: MOCK_RID,
        route: "/api/backoffice/ai/block-builder",
        method: "POST",
        scope: { role: "superadmin", email: "test@lunchportalen.no" },
      },
    });
    requireRoleOr403Mock.mockReturnValue(null);
  });

  test("returns 401 when not authenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false }), { status: 401 }),
    });
    const req = mkReq("http://localhost/api/backoffice/ai/block-builder", {
      method: "POST",
      body: { description: "hero" },
    });
    const res = await BlockBuilderPOST(req);
    expect(res.status).toBe(401);
  });

  test("returns 403 when role gate denies", async () => {
    requireRoleOr403Mock.mockReturnValue(
      new Response(JSON.stringify({ ok: false, error: "FORBIDDEN" }), { status: 403 }),
    );
    const req = mkReq("http://localhost/api/backoffice/ai/block-builder", {
      method: "POST",
      body: { description: "hero" },
    });
    const res = await BlockBuilderPOST(req);
    expect(res.status).toBe(403);
  });

  test("returns 503 when AI is disabled", async () => {
    isAIEnabledMock.mockReturnValue(false);
    const req = mkReq("http://localhost/api/backoffice/ai/block-builder", {
      method: "POST",
      body: { description: "hero" },
    });
    const res = await BlockBuilderPOST(req);
    expect(res.status).toBe(503);
    const data = await readJson(res);
    expect(data.error).toBe("FEATURE_DISABLED");
  });

  test("returns 400 when description is missing", async () => {
    const req = mkReq("http://localhost/api/backoffice/ai/block-builder", {
      method: "POST",
      body: { description: "   " },
    });
    const res = await BlockBuilderPOST(req);
    expect(res.status).toBe(400);
    const data = await readJson(res);
    expect(data.error).toBe("MISSING_DESCRIPTION");
  });

  test("returns 200 and calls buildBlockFromDescription with normalized input", async () => {
    const req = mkReq("http://localhost/api/backoffice/ai/block-builder", {
      method: "POST",
      body: {
        description: "  hero block  ",
        preferredType: "hero",
        locale: "nb",
        pageId: "page-1",
        variantId: "var-1",
        context: { section: "hero" },
      },
    });
    const res = await BlockBuilderPOST(req);
    expect(res.status).toBe(200);
    expect(buildBlockFromDescriptionMock).toHaveBeenCalledTimes(1);
    const arg = buildBlockFromDescriptionMock.mock.calls[0][0];
    expect(arg.description).toBe("hero block");
    const data = await readJson(res);
    expect(data.ok).toBe(true);
    expect(data.data?.block?.type ?? data.block?.type).toBe("hero");
  });
});

