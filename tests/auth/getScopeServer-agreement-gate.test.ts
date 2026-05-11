// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from "vitest";

let tables: string[] = [];
let agreementRow: any;

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: async () => ({
    ok: true,
    isAuthenticated: true,
    reason: "OK",
    mode: "DB_LOOKUP",
    userId: "u1",
    email: "admin@example.no",
    role: "company_admin",
    company_id: "cA",
    location_id: "lA",
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (table: string) => {
      tables.push(table);
      const q: any = {
        select: () => q,
        eq: () => q,
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (table === "companies") return { data: { id: "cA", status: "ACTIVE" }, error: null };
          if (table === "agreements") return { data: agreementRow, error: null };
          return { data: null, error: null };
        },
        then: (resolve: any) => resolve({ data: table === "agreements" && agreementRow ? [agreementRow] : [], error: null }),
      };
      return q;
    },
  }),
}));

import { getScopeServer } from "@/lib/auth/getScopeServer";

beforeEach(() => {
  tables = [];
  agreementRow = { company_id: "cA", status: "ACTIVE" };
});

describe("getScopeServer agreement gate", () => {
  test("uses agreements as active agreement truth for company_admin", async () => {
    const { scope } = await getScopeServer();

    expect(scope.role).toBe("company_admin");
    expect(scope.company_id).toBe("cA");
    expect(scope.agreement_status).toBe("active");
    expect(scope.billing_hold).toBe(false);
    expect(scope.can_act).toBe(true);
    expect(tables).toContain("agreements");
    expect(tables).not.toContain("company_billing_accounts");
  });

  test("fails closed when no ACTIVE agreement exists", async () => {
    agreementRow = null;

    await expect(getScopeServer()).rejects.toMatchObject({ code: "AGREEMENT_MISSING" });
  });
});
