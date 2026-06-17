import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { providerRoleSatisfies } from "@/lib/auth/provider";
import { authorizeProviderCustomerAdmin } from "@/lib/server/provider/providerCustomerRouteAuth";

const ROOT = process.cwd();

const MELHUS_PROVIDER_ID = "11111111-1111-1111-1111-111111111111";
const PETTERSEN_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OTHER_PROVIDER_ID = "22222222-2222-2222-2222-222222222222";
const USER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

vi.mock("@/lib/http/routeGuard", () => ({
  scopeOr401: vi.fn(async () => ({
    ok: true,
    ctx: {
      rid: "rid_test_auth",
      scope: { userId: USER_ID, email: "admin@melhus.no", role: "provider_admin" },
    },
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: vi.fn(),
}));

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

  it("blokkerer bruker uten provider_admin membership", async () => {
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
      expect(body.message).toContain("gjenopprette");
      expect(body.error).toBe("FORBIDDEN");
    }
  });

  it("blokkerer cross-provider membership", async () => {
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
  });

  it("restore route bruker admin membership auth og presise feilmeldinger", () => {
    const route = readFileSync(
      join(ROOT, "app/api/provider/customers/[companyId]/restore/route.ts"),
      "utf8"
    );
    expect(route).toContain("authorizeProviderCustomerAdmin");
    expect(route).not.toContain("hasProviderRole");
    expect(route).toContain("Du har ikke tilgang til å gjenopprette denne kunden.");
    expect(route).not.toContain("lp_order_set");
    expect(route).not.toContain("lp_order_advance_status");
  });

  it("provider_admin hierarchy forblir uendret", () => {
    expect(providerRoleSatisfies("provider_admin", "provider_admin")).toBe(true);
    expect(providerRoleSatisfies("provider_viewer", "provider_admin")).toBe(false);
  });
});
