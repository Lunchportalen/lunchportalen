// tests/auth/postLoginRedirectSafety.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

function mkReq(url: string): any {
  return {
    nextUrl: new URL(url),
    headers: new Headers(),
    cookies: {
      getAll() {
        return [];
      },
    },
  };
}

describe("POST-login redirect safety (/api/auth/post-login GET)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("rejects unsafe next (external-style) and falls back to role home", async () => {
    vi.mock("@/lib/auth/getAuthContext", () => ({
      getAuthContext: vi.fn(async () => ({
        ok: true,
        reason: "OK",
        mode: "DB_LOOKUP",
        user: { id: "u1", email: "emp@test.no" },
        role: "employee",
        company_id: "c1",
        location_id: "l1",
        rid: "rid_test",
      })),
    }));

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login?next=//evil.com");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    expect(location.startsWith("https://example.com/week")).toBe(true);
    expect(location).not.toContain("evil.com");
  });

  test("employee cannot be redirected to /admin via next param", async () => {
    vi.mock("@/lib/auth/getAuthContext", () => ({
      getAuthContext: vi.fn(async () => ({
        ok: true,
        reason: "OK",
        mode: "DB_LOOKUP",
        user: { id: "u1", email: "emp@test.no" },
        role: "employee",
        company_id: "c1",
        location_id: "l1",
        rid: "rid_emp_admin",
      })),
    }));

    const { GET } = await import("../../app/api/auth/post-login/route");
    const req = mkReq("https://example.com/api/auth/post-login?next=/admin");

    const res = await GET(req as any);
    expect(res.status).toBe(303);
    const location = res.headers.get("location")!;
    // Employee should always land on /week, not /admin
    expect(location.startsWith("https://example.com/week")).toBe(true);
    expect(location).not.toContain("/admin");
  });
});

