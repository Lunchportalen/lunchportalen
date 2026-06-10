// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from "vitest";

let membershipResult: any = null;
let providerMembershipRows: any[] = [];
let providerMembershipError: any = null;

vi.mock("@/lib/cache/authCache", () => ({
  getAuthCache: vi.fn(async () => null),
  setAuthCache: vi.fn(async () => undefined),
  invalidateAuthCache: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth/membershipLookup", () => ({
  lookupMembership: vi.fn(async () => membershipResult),
}));

vi.mock("@/lib/system/emails", () => ({
  systemRoleByEmail: () => null,
  SYSTEM_EMAILS: { ORDER: "ordre@lunchportalen.no" },
}));

vi.mock("@/lib/supabase/ssrSessionCookies", () => ({
  hasSupabaseSsrAuthCookieInJar: () => true,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [{ name: "sb-test-auth-token", value: "token" }],
    get: () => undefined,
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: {
      getUser: async () => ({
        data: {
          user: { id: "93882f96-38e6-4fdc-8e56-72577e5d595b", email: "post@melhuscatering.no" },
        },
        error: null,
      }),
    },
    from: (_table: string) => ({
      select: (_columns: string) => ({
        eq: (_column: string, _value: string) => ({
          limit: async (_n: number) => ({ data: providerMembershipRows, error: providerMembershipError }),
        }),
      }),
    }),
  }),
}));

import { getAuthContext } from "@/lib/auth/getAuthContext";

beforeEach(() => {
  membershipResult = null;
  providerMembershipRows = [];
  providerMembershipError = null;
});

describe("getAuthContext provider role", () => {
  test("provider_admin profile with provider_memberships row → ok, no company required", async () => {
    membershipResult = {
      ok: true,
      source: "profiles",
      role: "provider_admin",
      company_id: null,
      location_id: null,
      status: null,
      updated_at: null,
    };
    providerMembershipRows = [{ id: "dabc1f66-041e-44f5-b2b8-5531c5dcb62b" }];

    const ctx = await getAuthContext({ rid: "rid_provider_ok" });

    expect(ctx.ok).toBe(true);
    expect(ctx.reason).toBe("OK");
    expect(ctx.role).toBe("provider_admin");
    expect(ctx.company_id).toBeNull();
  });

  test("provider_admin profile WITHOUT membership row → fail closed NO_PROFILE", async () => {
    membershipResult = {
      ok: true,
      source: "profiles",
      role: "provider_admin",
      company_id: null,
      location_id: null,
      status: null,
      updated_at: null,
    };
    providerMembershipRows = [];

    const ctx = await getAuthContext({ rid: "rid_provider_orphan" });

    expect(ctx.ok).toBe(false);
    expect(ctx.reason).toBe("NO_PROFILE");
    expect(ctx.role).toBeNull();
  });

  test("provider role with membership query error → fail closed NO_PROFILE", async () => {
    membershipResult = {
      ok: true,
      source: "profiles",
      role: "provider_kitchen",
      company_id: null,
      location_id: null,
      status: null,
      updated_at: null,
    };
    providerMembershipRows = [];
    providerMembershipError = { message: "query failed" };

    const ctx = await getAuthContext({ rid: "rid_provider_err" });

    expect(ctx.ok).toBe(false);
    expect(ctx.reason).toBe("NO_PROFILE");
  });

  test("employee without company_id → still NO_PROFILE (unchanged)", async () => {
    membershipResult = {
      ok: true,
      source: "profiles",
      role: "employee",
      company_id: null,
      location_id: null,
      status: null,
      updated_at: null,
    };
    // Membership row present must NOT rescue a non-provider role.
    providerMembershipRows = [{ id: "irrelevant" }];

    const ctx = await getAuthContext({ rid: "rid_employee_no_company" });

    expect(ctx.ok).toBe(false);
    expect(ctx.reason).toBe("NO_PROFILE");
  });

  test("company_admin with company_id → unchanged OK path", async () => {
    membershipResult = {
      ok: true,
      source: "profiles",
      role: "company_admin",
      company_id: "d60b2b4c-ac90-44a4-bbbe-45d3dfd89ea7",
      location_id: null,
      status: "active",
      updated_at: "2026-06-10T00:00:00.000Z",
    };

    const ctx = await getAuthContext({ rid: "rid_company_admin" });

    expect(ctx.ok).toBe(true);
    expect(ctx.role).toBe("company_admin");
    expect(ctx.company_id).toBe("d60b2b4c-ac90-44a4-bbbe-45d3dfd89ea7");
  });
});
