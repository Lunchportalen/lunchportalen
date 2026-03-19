/**
 * routeGuard consistency: denyResponse, requireRoleOr403 return correct status and shape.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  denyResponse,
  requireRoleOr403,
  requireCompanyScopeOr403,
  readJson,
  pickRid,
  roleFromCtx,
  companyIdFromCtx,
  type ScopeOr401Result,
  type AuthedCtx,
} from "@/lib/http/routeGuard";

function makeCtx(overrides: Partial<AuthedCtx> = {}): AuthedCtx {
  return {
    rid: "rid_test_123",
    route: "/api/test",
    method: "GET",
    scope: {
      userId: "u1",
      role: "superadmin",
      companyId: null,
      locationId: null,
      email: "super@test",
      sub: "sub_u1",
    },
    ...overrides,
  };
}

describe("routeGuard consistency", () => {
  describe("denyResponse", () => {
    it("returns 401 when ok is false and res is provided", () => {
      const res = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      const s: ScopeOr401Result = { ok: false, res, response: res, ctx: makeCtx() };
      const out = denyResponse(s);
      expect(out).toBeInstanceOf(Response);
      expect(out.status).toBe(401);
    });

    it("returns 401 when ok is false and response is provided", () => {
      const response = new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
      const s: ScopeOr401Result = { ok: false, res: response, response, ctx: makeCtx() };
      const out = denyResponse(s);
      expect(out.status).toBe(401);
    });

    it("returns 401 when s is null (missing/broken auth fails closed)", () => {
      const out = denyResponse(null as unknown as ScopeOr401Result);
      expect(out).toBeInstanceOf(Response);
      expect(out.status).toBe(401);
    });

    it("returns 401 when s is undefined (missing/broken auth fails closed)", () => {
      const out = denyResponse(undefined as unknown as ScopeOr401Result);
      expect(out).toBeInstanceOf(Response);
      expect(out.status).toBe(401);
    });
  });

  describe("requireRoleOr403", () => {
    it("(ctx, action, allowed): returns null when role is in allowed", () => {
      const base = makeCtx();
      const ctx = makeCtx({ scope: { ...base.scope, role: "superadmin" } });
      const out = requireRoleOr403(ctx, "api.superadmin.system.health.GET", ["superadmin"]);
      expect(out).toBeNull();
    });

    it("(ctx, action, allowed): returns 403 when role is not in allowed", () => {
      const base = makeCtx();
      const ctx = makeCtx({ scope: { ...base.scope, role: "employee" } });
      const out = requireRoleOr403(ctx, "api.superadmin.system.health.GET", ["superadmin"]);
      expect(out).toBeInstanceOf(Response);
      expect(out!.status).toBe(403);
    });

    it("(ctx, action, allowed): returns 403 when role is null", () => {
      const base = makeCtx();
      const ctx = makeCtx({ scope: { ...base.scope, role: null } });
      const out = requireRoleOr403(ctx, "api.x", ["superadmin"]);
      expect(out).toBeInstanceOf(Response);
      expect(out!.status).toBe(403);
    });

    it("(rid, role, allowed): returns null when role is in allowed", () => {
      const out = requireRoleOr403("rid_1", "superadmin", ["superadmin", "company_admin"]);
      expect(out).toBeNull();
    });

    it("(rid, role, allowed): returns 403 when role is not in allowed", () => {
      const out = requireRoleOr403("rid_1", "employee", ["superadmin"]);
      expect(out).toBeInstanceOf(Response);
      expect(out!.status).toBe(403);
    });

    it("normalizes company_admin alias", () => {
      const base = makeCtx();
      const ctx = makeCtx({ scope: { ...base.scope, role: "company_admin" } });
      const out = requireRoleOr403(ctx, "api.admin.x", ["company_admin"]);
      expect(out).toBeNull();
    });
  });

  describe("requireCompanyScopeOr403", () => {
    it("returns null when companyId is present for company_admin", () => {
      const ctx = makeCtx({
        scope: {
          userId: "u1",
          role: "company_admin",
          companyId: "c1",
          locationId: null,
          email: "a@test",
          sub: "sub_u1",
        },
      });
      const out = requireCompanyScopeOr403(ctx);
      expect(out).toBeNull();
    });

    it("returns 403 when role is employee (no company scope check needed for 403)", () => {
      const ctx = makeCtx({
        scope: {
          userId: "u1",
          role: "employee",
          companyId: null,
          locationId: null,
          email: "e@test",
          sub: "sub_u1",
        },
      });
      const out = requireCompanyScopeOr403(ctx);
      expect(out).toBeInstanceOf(Response);
      expect(out!.status).toBe(403);
    });
  });

  describe("readJson", () => {
    it("returns empty object for empty body", async () => {
      const req = new NextRequest("http://localhost/api/test", {
        method: "POST",
        body: "",
      });
      const out = await readJson(req);
      expect(out).toEqual({});
    });

    it("parses valid JSON body", async () => {
      const req = new NextRequest("http://localhost/api/test", {
        method: "POST",
        body: '{"a":1}',
      });
      const out = await readJson(req);
      expect(out).toEqual({ a: 1 });
    });
  });

  describe("pickRid", () => {
    it("returns rid from ctx", () => {
      const ctx = makeCtx();
      expect(pickRid(ctx)).toBe("rid_test_123");
    });

    it("returns rid from string", () => {
      expect(pickRid("rid_abc")).toBe("rid_abc");
    });
  });

  describe("roleFromCtx", () => {
    it("returns normalized role from ctx", () => {
      const base = makeCtx();
      const ctx = makeCtx({ scope: { ...base.scope, role: "company_admin" } });
      expect(roleFromCtx(ctx)).toBe("company_admin");
    });
  });

  describe("companyIdFromCtx", () => {
    it("returns companyId from ctx", () => {
      const base = makeCtx();
      const ctx = makeCtx({ scope: { ...base.scope, companyId: "company-uuid" } });
      expect(companyIdFromCtx(ctx)).toBe("company-uuid");
    });
  });
});
