// @ts-nocheck
/**
 * Regression: /api/admin/company/status/set skal ikke la company_admin (eller noen) mutere firmastatus.
 * Canonical skrivebane er superadmin set-status.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import type { AuthedCtx } from "@/lib/http/routeGuard";

const scopeOr401Mock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/http/routeGuard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/http/routeGuard")>();
  return {
    ...actual,
    scopeOr401: (...args: unknown[]) => scopeOr401Mock(...args),
  };
});

function authedCompanyAdmin(): { ok: true; ctx: AuthedCtx } {
  return {
    ok: true,
    ctx: {
      rid: "rid_admin_status",
      route: "/api/admin/company/status/set",
      method: "POST",
      scope: {
        userId: "user-1",
        role: "company_admin",
        companyId: "00000000-0000-4000-8000-0000000000cc",
        locationId: null,
        email: "ca@test.no",
        sub: "sub-1",
      },
    },
  };
}

describe("POST /api/admin/company/status/set", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("403 for company_admin — ingen DB-mutasjon via denne ruten", async () => {
    scopeOr401Mock.mockResolvedValue(authedCompanyAdmin());
    const { POST } = await import("@/app/api/admin/company/status/set/route");
    const req = new NextRequest("http://localhost/api/admin/company/status/set", {
      method: "POST",
      body: JSON.stringify({ status: "ACTIVE" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
    const j = await res.json();
    expect(j.ok).toBe(false);
    expect(String(j.error || "")).toContain("FORBIDDEN");
  });
});
