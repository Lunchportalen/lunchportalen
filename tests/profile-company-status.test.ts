// tests/profile-company-status.test.ts
// @ts-nocheck
import { describe, test, expect, beforeEach, vi } from "vitest";

function readJson(res: Response) {
  return res.text().then((t) => (t ? JSON.parse(t) : null));
}

let profileRow: any = null;
let companyRow: any = null;
let profileErr: any = null;
let companyErr: any = null;
const getAuthContextMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: getAuthContextMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (_table: string) => ({
      select: (_s: string) => ({
        eq: (_k: string, _v: any) => ({
          maybeSingle: async () => ({ data: profileRow, error: profileErr }),
        }),
      }),
    }),
  }),
}));

vi.mock(import("@/lib/supabase/admin"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    hasSupabaseAdminConfig: () => false,

  supabaseAdmin: () => ({
    from: (_table: string) => ({
      select: (_s: string) => ({
        eq: (_k: string, _v: any) => ({
          maybeSingle: async () => ({ data: companyRow, error: companyErr }),
        }),
      }),
    }),
  }),
  };
});

import { GET as profileGET } from "../app/api/profile/route";

beforeEach(() => {
  profileRow = {
    id: "u1",
    role: "employee",
    company_id: "c1",
    location_id: "l1",
    is_active: true,
    disabled_at: null,
    disabled_reason: null,
  };
  companyRow = { id: "c1", status: "PENDING" };
  profileErr = null;
  companyErr = null;
  getAuthContextMock.mockResolvedValue({
    ok: true,
    reason: "OK",
    mode: "DB_LOOKUP",
    user: { id: "u1", email: "user@example.com" },
    role: "employee",
    company_id: "c1",
    location_id: "l1",
    rid: "rid_profile_status",
    userId: "u1",
    email: "user@example.com",
    isAuthenticated: true,
    isSessionValid: true,
    isRefreshable: true,
    hasAuthError: false,
    errorType: "NONE",
    source: "SSR_COOKIE",
    sessionOk: true,
    shouldAttemptRefresh: false,
  });
});

describe("api/profile company status gate", () => {
  test("pending company returns ok:true pending", async () => {
    companyRow = { id: "c1", status: "PENDING" };
    const res = await profileGET();
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data?.pending).toBe(true);
    expect(json.data?.company_status).toBe("PENDING");
    expect(json.data?.profileExists).toBe(true);
  });

  test("active company returns pending false", async () => {
    companyRow = { id: "c1", status: "ACTIVE" };
    const res = await profileGET();
    expect(res.status).toBe(200);
    const json = await readJson(res);
    expect(json.ok).toBe(true);
    expect(json.data?.pending).toBe(false);
    expect(json.data?.profileExists).toBe(true);
    expect(json.data?.profile?.company_id).toBe("c1");
  });
});
