// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from "vitest";

let tables: string[] = [];
let agreementRow: any;
let billingRow: any;
let authCompanyId: string | null = null;
let eqCalls: Array<{ table: string; key: string; value: string }> = [];

const COMPANY_ID = "d60b2b4c-ac90-44a4-bbbe-45d3dfd89ea7";

vi.mock("@/lib/auth/getAuthContext", () => ({
  getAuthContext: async () => ({
    ok: true,
    isAuthenticated: true,
    reason: "OK",
    mode: "DB_LOOKUP",
    userId: "u1",
    email: "admin@example.no",
    role: "company_admin",
    company_id: authCompanyId,
    location_id: "lA",
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    from: (table: string) => {
      tables.push(table);
      const q: any = {
        select: () => q,
        eq: (key: string, value: any) => {
          eqCalls.push({ table, key, value: String(value ?? "") });
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (table === "companies") return { data: { id: COMPANY_ID, status: "ACTIVE" }, error: null };
          if (table === "company_current_agreement") return { data: agreementRow, error: null };
          if (table === "company_billing_accounts") return { data: billingRow, error: null };
          if (table === "agreements") return { data: null, error: null };
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
  eqCalls = [];
  authCompanyId = COMPANY_ID;
  agreementRow = { agreement_id: "ag_1", company_id: COMPANY_ID, status: "ACTIVE", tier: "BASIS" };
  billingRow = { company_id: COMPANY_ID, hold_active: false, billing_hold: false };
});

describe("getScopeServer agreement gate", () => {
  test("uses company_current_agreement as active agreement truth for company_admin", async () => {
    const { scope } = await getScopeServer();

    expect(scope.role).toBe("company_admin");
    expect(scope.company_id).toBe(COMPANY_ID);
    expect(scope.agreement_status).toBe("active");
    expect(scope.billing_hold).toBe(false);
    expect(scope.can_act).toBe(true);
    expect(tables).toContain("company_current_agreement");
    expect(tables).toContain("company_billing_accounts");
  });

  test("fails closed when no ACTIVE agreement exists", async () => {
    agreementRow = null;

    await expect(getScopeServer()).rejects.toMatchObject({ code: "AGREEMENT_MISSING" });
  });

  test("trims company_id before agreement scope queries", async () => {
    authCompanyId = ` ${COMPANY_ID} `;

    const { scope } = await getScopeServer();

    expect(scope.company_id).toBe(COMPANY_ID);
    expect(eqCalls).toContainEqual({ table: "company_current_agreement", key: "company_id", value: COMPANY_ID });
  });

  test("keeps return shape and blocks actions when billing hold is active", async () => {
    billingRow = { company_id: COMPANY_ID, hold_active: true };

    const { scope } = await getScopeServer();

    expect(scope.agreement_status).toBe("active");
    expect(scope.billing_hold).toBe(true);
    expect(scope.billing_hold_reason).toBe("BILLING_HOLD");
    expect(scope.can_act).toBe(false);
  });

  test("fails closed when company_id is whitespace", async () => {
    authCompanyId = " ";

    await expect(getScopeServer()).rejects.toMatchObject({ code: "COMPANY_MISSING" });
  });
});
