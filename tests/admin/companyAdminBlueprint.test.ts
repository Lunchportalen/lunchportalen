/**
 * Closeout 4B — minimal regression: company_admin tenant lock (query cannot expand scope).
 * Guards live in lib/http/routeGuard.ts; this file re-verifies blueprint-critical paths.
 */
import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { resolveAdminTenantCompanyId, requireRoleOr403, type AuthedCtx } from "@/lib/http/routeGuard";

function makeCtx(overrides: Partial<AuthedCtx> = {}): AuthedCtx {
  return {
    rid: "rid_blueprint",
    route: "/api/admin/x",
    method: "GET",
    scope: {
      userId: "u1",
      role: "company_admin",
      companyId: "firm-scoped",
      locationId: null,
      email: "a@test",
      sub: "sub_u1",
    },
    ...overrides,
  };
}

describe("company_admin blueprint — tenant lock", () => {
  it("resolveAdminTenantCompanyId: foreign company_id in query → 403", () => {
    const ctx = makeCtx();
    const req = new NextRequest("http://localhost/api/admin/x?company_id=firm-other");
    const out = resolveAdminTenantCompanyId(ctx, req);
    expect(out.ok).toBe(false);
    if (out.ok === false) expect(out.res.status).toBe(403);
  });

  it("requireRoleOr403: superadmin cannot pass company_admin-only gate", () => {
    const ctx = makeCtx({
      scope: {
        userId: "s1",
        role: "superadmin",
        companyId: null,
        locationId: null,
        email: "s@test",
        sub: "sub_s",
      },
    });
    const out = requireRoleOr403(ctx, "admin.insights.read", ["company_admin"]);
    expect(out).toBeInstanceOf(Response);
    expect((out as Response).status).toBe(403);
  });
});
