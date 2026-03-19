/**
 * Editor-AI permission guarantees: unauthorized users cannot use privileged editor AI.
 * 401 when unauthenticated; 403 when not superadmin. Uses existing route test patterns.
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

const scopeOr401Mock = vi.hoisted(() => vi.fn());
const requireRoleOr403Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: scopeOr401Mock,
  requireRoleOr403: (ctx: any, allowed: string[]) => {
    const role = ctx?.scope?.role;
    if (allowed?.includes?.("superadmin") && allowed.length === 1 && role !== "superadmin") {
      return new Response(JSON.stringify({ ok: false, error: "FORBIDDEN", status: 403 }), {
        status: 403,
        headers: { "content-type": "application/json" },
      });
    }
    return requireRoleOr403Mock(ctx, allowed);
  },
}));

describe("Editor-AI permission guarantees – unauthenticated returns 401", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { "content-type": "application/json" },
      }),
    });
  });

  test("POST /api/backoffice/ai/suggest returns 401 when not authenticated", async () => {
    const { POST } = await import("../../app/api/backoffice/ai/suggest/route");
    const req = mkReq("http://localhost/api/backoffice/ai/suggest", {
      method: "POST",
      body: { tool: "content.maintain.page", pageId: "p1", input: {}, blocks: [], existingBlocks: [], meta: {}, environment: "preview", locale: "nb" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("POST /api/backoffice/ai/block-builder returns 401 when not authenticated", async () => {
    const { POST } = await import("../../app/api/backoffice/ai/block-builder/route");
    const req = mkReq("http://localhost/api/backoffice/ai/block-builder", {
      method: "POST",
      body: { description: "hero block" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  test("POST /api/backoffice/ai/apply returns 401 when not authenticated", async () => {
    const { POST } = await import("../../app/api/backoffice/ai/apply/route");
    const req = mkReq("http://localhost/api/backoffice/ai/apply", {
      method: "POST",
      body: { tool: "apply", pageId: "p1", environment: "preview", locale: "nb" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("Editor-AI permission guarantees – company_admin returns 403", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: {
        rid: "rid_editor_ai",
        route: "/api/backoffice/ai/suggest",
        method: "POST",
        scope: { role: "company_admin", email: "admin@company.no" },
      },
    });
    requireRoleOr403Mock.mockReturnValue(null);
  });

  test("POST /api/backoffice/ai/suggest returns 403 for company_admin", async () => {
    const { POST } = await import("../../app/api/backoffice/ai/suggest/route");
    const req = mkReq("http://localhost/api/backoffice/ai/suggest", {
      method: "POST",
      body: { tool: "content.maintain.page", pageId: "p1", input: {}, blocks: [], existingBlocks: [], meta: {}, environment: "preview", locale: "nb" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data?.error).toBe("FORBIDDEN");
  });

  test("POST /api/backoffice/ai/block-builder returns 403 for company_admin", async () => {
    const { POST } = await import("../../app/api/backoffice/ai/block-builder/route");
    const req = mkReq("http://localhost/api/backoffice/ai/block-builder", {
      method: "POST",
      body: { description: "hero" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data?.error).toBe("FORBIDDEN");
  });

  test("POST /api/backoffice/ai/apply returns 403 for company_admin", async () => {
    const { POST } = await import("../../app/api/backoffice/ai/apply/route");
    const req = mkReq("http://localhost/api/backoffice/ai/apply", {
      method: "POST",
      body: { tool: "apply", pageId: "p1", environment: "preview", locale: "nb" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const data = await readJson(res);
    expect(data?.error).toBe("FORBIDDEN");
  });
});
