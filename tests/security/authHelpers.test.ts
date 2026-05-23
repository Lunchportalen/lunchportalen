// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

const scopeOr401Mock = vi.fn();
const requireRoleOr403Mock = vi.fn();

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: (...args: unknown[]) => scopeOr401Mock(...args),
  requireRoleOr403: (...args: unknown[]) => requireRoleOr403Mock(...args),
  denyResponse: (gate: { res?: Response }) => gate.res ?? new Response(null, { status: 401 }),
}));

import {
  HttpAuthError,
  requireUser,
  requireSuperadmin,
  denyUnlessSession,
  authErrorToResponse,
} from "@/lib/server/auth/requireUser";

function mkReq(url = "http://localhost/api/test") {
  return new Request(url) as any;
}

describe("requireUser", () => {
  beforeEach(() => {
    scopeOr401Mock.mockReset();
    requireRoleOr403Mock.mockReset();
  });

  test("PASS: returns ctx when scopeOr401 ok", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "r1", scope: { userId: "u1", role: "employee", companyId: null, locationId: null, email: null, sub: null } },
    });
    const ctx = await requireUser(mkReq());
    expect(ctx.scope.userId).toBe("u1");
  });

  test("FAIL: throws 401 when scopeOr401 not ok", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false, status: 401 }), { status: 401 }),
      ctx: { rid: "r1", scope: {} },
    });
    await expect(requireUser(mkReq())).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
  });

  test("FAIL: throws 401 when userId missing", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "r1", scope: { userId: null, role: null, companyId: null, locationId: null, email: null, sub: null } },
    });
    await expect(requireUser(mkReq())).rejects.toMatchObject({ status: 401 });
  });
});

describe("requireSuperadmin", () => {
  beforeEach(() => {
    scopeOr401Mock.mockReset();
    requireRoleOr403Mock.mockReset();
  });

  test("PASS: returns ctx for superadmin", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "r1", scope: { userId: "u1", role: "superadmin", companyId: null, locationId: null, email: null, sub: null } },
    });
    requireRoleOr403Mock.mockReturnValue(null);
    const ctx = await requireSuperadmin(mkReq());
    expect(ctx.scope.role).toBe("superadmin");
  });

  test("FAIL: throws 403 when role denied", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "r1", scope: { userId: "u1", role: "employee", companyId: null, locationId: null, email: null, sub: null } },
    });
    requireRoleOr403Mock.mockReturnValue(new Response(null, { status: 403 }));
    await expect(requireSuperadmin(mkReq())).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
  });

  test("FAIL: throws 401 when not logged in", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(null, { status: 401 }),
      ctx: { rid: "r1", scope: {} },
    });
    await expect(requireSuperadmin(mkReq())).rejects.toMatchObject({ status: 401 });
  });
});

describe("denyUnlessSession", () => {
  beforeEach(() => {
    scopeOr401Mock.mockReset();
  });

  test("PASS: returns null when session ok", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: true,
      ctx: { rid: "r1", scope: { userId: "u1", role: "employee", companyId: null, locationId: null, email: null, sub: null } },
    });
    await expect(denyUnlessSession(mkReq())).resolves.toBeNull();
  });

  test("FAIL: returns Response when unauthenticated", async () => {
    scopeOr401Mock.mockResolvedValue({
      ok: false,
      res: new Response(JSON.stringify({ ok: false }), { status: 401 }),
      ctx: { rid: "r1", scope: {} },
    });
    const res = await denyUnlessSession(mkReq());
    expect(res?.status).toBe(401);
  });
});

describe("authErrorToResponse", () => {
  test("maps HttpAuthError with embedded response", () => {
    const embedded = new Response("x", { status: 401 });
    const res = authErrorToResponse(new HttpAuthError(401, "UNAUTHORIZED", "nope", embedded));
    expect(res).toBe(embedded);
  });
});
