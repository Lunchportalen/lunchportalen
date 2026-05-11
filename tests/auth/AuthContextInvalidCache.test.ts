// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from "vitest";

let cachedClaims: any = null;
let invalidatedUserId: string | null = null;
let lookupCalled = false;

vi.mock("@/lib/cache/authCache", () => ({
  getAuthCache: vi.fn(async () => cachedClaims),
  setAuthCache: vi.fn(async () => undefined),
  invalidateAuthCache: vi.fn(async (userId: string) => {
    invalidatedUserId = userId;
    cachedClaims = null;
  }),
}));

vi.mock("@/lib/auth/membershipLookup", () => ({
  lookupMembership: vi.fn(async () => {
    lookupCalled = true;
    return {
      ok: true,
      source: "profiles",
      role: "company_admin",
      company_id: "d60b2b4c-ac90-44a4-bbbe-45d3dfd89ea7",
      location_id: null,
      status: "active",
      updated_at: "2026-05-11T00:00:00.000Z",
    };
  }),
}));

vi.mock("@/lib/system/emails", () => ({
  systemRoleByEmail: () => null,
  SYSTEM_EMAILS: { ORDER: "ordre@lunchportalen.no" },
}));

vi.mock("@/utils/supabase/ssrSessionCookies", () => ({
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
        data: { user: { id: "8ad84d06-37cc-4a85-8950-21d688f93a68", email: "inger@melhuscatering.no" } },
        error: null,
      }),
    },
  }),
}));

import { getAuthContext } from "@/lib/auth/getAuthContext";

beforeEach(() => {
  cachedClaims = null;
  invalidatedUserId = null;
  lookupCalled = false;
});

describe("getAuthContext invalid auth cache", () => {
  test("ignores whitespace company_id cache and falls through to membership lookup", async () => {
    cachedClaims = {
      role: "company_admin",
      company_id: " ",
      location_id: null,
      status: "active",
      updated_at: "old",
    };

    const ctx = await getAuthContext({ rid: "rid_invalid_cache" });

    expect(lookupCalled).toBe(true);
    expect(invalidatedUserId).toBe("8ad84d06-37cc-4a85-8950-21d688f93a68");
    expect(ctx.ok).toBe(true);
    expect(ctx.mode).toBe("DB_LOOKUP");
    expect(ctx.role).toBe("company_admin");
    expect(ctx.company_id).toBe("d60b2b4c-ac90-44a4-bbbe-45d3dfd89ea7");
  });
});
