import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { providerRoleSatisfies } from "@/lib/auth/provider";
import type { AuthRole } from "@/lib/auth/getAuthContext";
import { authorizeProviderCustomerAdmin } from "@/lib/server/provider/providerCustomerRouteAuth";

const ROOT = process.cwd();

const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const PETTERSEN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_PROVIDER_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: vi.fn(),
  isProviderAuthRole: (role: string | null) =>
    role === "provider_admin" || role === "provider_kitchen" || role === "provider_viewer",
}));

vi.mock("@/lib/ops/log", () => ({
  opsLog: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(),
}));

async function mockProviderAuth(role: AuthRole = "provider_admin") {
  const { getAuthContext } = await import("@/lib/auth/getAuthContext");
  vi.mocked(getAuthContext).mockResolvedValue({
    isAuthenticated: Boolean(role),
    userId: role ? USER_ID : null,
    email: "admin@melhus.no",
    role,
    rid: "rid_test_auth",
    ok: Boolean(role),
    reason: role ? "OK" : "UNAUTHENTICATED",
    mode: "DB_LOOKUP",
    user: role ? { id: USER_ID, email: "admin@melhus.no" } : null,
    company_id: null,
    location_id: null,
    isSessionValid: true,
    isRefreshable: true,
    hasAuthError: false,
    errorType: "NONE",
    source: "SSR_COOKIE",
    sessionOk: Boolean(role),
    shouldAttemptRefresh: false,
  });
}

function mkAdmin(state: {
  companies: Record<string, unknown>[];
  memberships: Record<string, unknown>[];
}) {
  return {
    from: (table: string) => {
      const b: any = {
        _eq: [] as Array<{ col: string; val: unknown }>,
        select: () => b,
        eq: (col: string, val: unknown) => {
          b._eq.push({ col, val });
          return b;
        },
        maybeSingle: async () => {
          if (table === "companies") {
            const idEq = b._eq.find((f: { col: string }) => f.col === "id");
            const row = state.companies.find((c) => c.id === idEq?.val) ?? null;
            return { data: row, error: null };
          }
          if (table === "provider_memberships") {
            const userEq = b._eq.find((f: { col: string }) => f.col === "user_id");
            const providerEq = b._eq.find((f: { col: string }) => f.col === "provider_id");
            const row =
              state.memberships.find(
                (m) => m.user_id === userEq?.val && m.provider_id === providerEq?.val
              ) ?? null;
            return { data: row, error: null };
          }
          return { data: null, error: null };
        },
      };
      return b;
    },
  };
}

describe("authorizeProviderCustomerAdmin", () => {
  it("tillater provider_admin via admin membership lookup for egen kunde", async () => {
    await mockProviderAuth("provider_admin");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin).mockReturnValue(
      mkAdmin({
        companies: [{ id: PETTERSEN_ID, provider_id: MELHUS_PROVIDER_ID }],
        memberships: [{ user_id: USER_ID, provider_id: MELHUS_PROVIDER_ID, role: "provider_admin" }],
      }) as any
    );

    const req = new Request("http://local/api/provider/customers/x/restore", { method: "POST" }) as any;
    const auth = await authorizeProviderCustomerAdmin(req, PETTERSEN_ID, "restore");
    expect(auth.ok).toBe(true);
    if (auth.ok) {
      expect(auth.providerId).toBe(MELHUS_PROVIDER_ID);
      expect(auth.companyId).toBe(PETTERSEN_ID);
    }
  });

  it("bruker getAuthContext — ikke scopeOr401/getScope som blokkerer provider-brukere", async () => {
    const routeAuth = readFileSync(
      join(ROOT, "lib/server/provider/providerCustomerRouteAuth.ts"),
      "utf8"
    );
    expect(routeAuth).toContain("getAuthContext");
    expect(routeAuth).not.toContain("scopeOr401");
  });

  it("returnerer PROVIDER_CONTEXT_MISSING for ikke-provider session", async () => {
    await mockProviderAuth("employee");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin).mockReturnValue(mkAdmin({ companies: [], memberships: [] }) as any);

    const req = new Request("http://local/api/provider/customers/x/restore", { method: "POST" }) as any;
    const auth = await authorizeProviderCustomerAdmin(req, PETTERSEN_ID, "restore");
    expect(auth.ok).toBe(false);
    if (auth.ok === false) {
      const body = await auth.res.json();
      expect(body.error).toBe("PROVIDER_CONTEXT_MISSING");
      expect(body.message).toContain("leverandørtilknytning");
    }
  });

  it("returnerer PROVIDER_ROLE_MISSING for provider_viewer", async () => {
    await mockProviderAuth("provider_viewer");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin).mockReturnValue(
      mkAdmin({
        companies: [{ id: PETTERSEN_ID, provider_id: MELHUS_PROVIDER_ID }],
        memberships: [{ user_id: USER_ID, provider_id: MELHUS_PROVIDER_ID, role: "provider_viewer" }],
      }) as any
    );

    const req = new Request("http://local/api/provider/customers/x/restore", { method: "POST" }) as any;
    const auth = await authorizeProviderCustomerAdmin(req, PETTERSEN_ID, "restore");
    expect(auth.ok).toBe(false);
    if (auth.ok === false) {
      const body = await auth.res.json();
      expect(body.error).toBe("PROVIDER_ROLE_MISSING");
      expect(body.message).toContain("administrator");
    }
  });

  it("blokkerer cross-provider membership", async () => {
    await mockProviderAuth("provider_admin");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin).mockReturnValue(
      mkAdmin({
        companies: [{ id: PETTERSEN_ID, provider_id: MELHUS_PROVIDER_ID }],
        memberships: [{ user_id: USER_ID, provider_id: OTHER_PROVIDER_ID, role: "provider_admin" }],
      }) as any
    );

    const req = new Request("http://local/api/provider/customers/x/restore", { method: "POST" }) as any;
    const auth = await authorizeProviderCustomerAdmin(req, PETTERSEN_ID, "restore");
    expect(auth.ok).toBe(false);
    if (auth.ok === false) {
      const body = await auth.res.json();
      expect(body.error).toBe("PROVIDER_ROLE_MISSING");
    }
  });

  it("provider id kommer fra company.provider_id — ikke company id", async () => {
    await mockProviderAuth("provider_admin");
    const { supabaseAdmin } = await import("@/lib/supabase/admin");
    vi.mocked(supabaseAdmin).mockReturnValue(
      mkAdmin({
        companies: [{ id: PETTERSEN_ID, provider_id: MELHUS_PROVIDER_ID }],
        memberships: [{ user_id: USER_ID, provider_id: MELHUS_PROVIDER_ID, role: "provider_admin" }],
      }) as any
    );

    const req = new Request("http://local/api/provider/customers/x/restore", { method: "POST" }) as any;
    const auth = await authorizeProviderCustomerAdmin(req, PETTERSEN_ID, "restore");
    expect(auth.ok).toBe(true);
    if (auth.ok) {
      expect(auth.providerId).toBe(MELHUS_PROVIDER_ID);
      expect(auth.providerId).not.toBe(PETTERSEN_ID);
    }
  });

  it("restore route bruker canonical provider auth og presise feilmeldinger", () => {
    const route = readFileSync(
      join(ROOT, "app/api/provider/customers/[companyId]/restore/route.ts"),
      "utf8"
    );
    expect(route).toContain("authorizeProviderCustomerAdmin");
    expect(route).not.toContain("hasProviderRole");
    expect(route).not.toContain("scopeOr401");
    expect(route).toContain("PROVIDER_ROLE_MISSING");
    expect(route).not.toContain("lp_order_set");
    expect(route).not.toContain("lp_order_advance_status");
  });

  it("provider_admin hierarchy forblir uendret", () => {
    expect(providerRoleSatisfies("provider_admin", "provider_admin")).toBe(true);
    expect(providerRoleSatisfies("provider_viewer", "provider_admin")).toBe(false);
  });
});
