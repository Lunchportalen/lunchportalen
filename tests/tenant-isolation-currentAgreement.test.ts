// tests/tenant-isolation-currentAgreement.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

let eqCalls: Array<{ table: string; key: string; value: string }> = [];
let mockAgreement: any;

const defaultAgreement = {
  id: "ag_a",
  company_id: "cA",
  status: "ACTIVE",
  delivery_days: ["mon", "tue"],
  tier: "BASIS",
  price_per_meal_nok: 95,
  starts_at: "2026-01-01",
  ends_at: null,
  updated_at: "2026-01-31T12:00:00Z",
};

function makeAdminClient() {
  return {
    from: (table: string) => {
      const q: any = {
        select: () => q,
        eq: (k: string, v: any) => {
          eqCalls.push({ table, key: k, value: String(v ?? "") });
          return q;
        },
        order: () => q,
        limit: () => q,
        maybeSingle: async () => {
          if (table === "agreements") {
            return {
              data: mockAgreement,
              error: null,
            };
          }
          return { data: null, error: null };
        },
      };
      return q;
    },
  };
}

function makeServerClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } }, error: null }) },
    from: (table: string) => {
      const q: any = {
        select: () => q,
        or: () => q,
        eq: (k: string, v: any) => {
          eqCalls.push({ table, key: k, value: String(v ?? "") });
          return q;
        },
        maybeSingle: async () => {
          if (table === "profiles") {
            return { data: { company_id: "cA", location_id: "lA" }, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: any) =>
          resolve({
            data: [{ day_key: "mon", tier: "BASIS", slot: "lunch", company_id: "cA" }],
            error: null,
          }),
      };
      return q;
    },
  };
}

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => makeServerClient(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => makeAdminClient(),
}));

import { getCurrentAgreementState } from "../lib/agreement/currentAgreement";

beforeEach(() => {
  eqCalls = [];
  mockAgreement = { ...defaultAgreement };
});

describe("tenant isolation – currentAgreement", () => {
  test("company_id is always filtered for agreement and daymap", async () => {
    const res = await getCurrentAgreementState({ rid: "rid_test" });
    expect(res.ok).toBe(true);

    const agreementFilter = eqCalls.find((c) => c.table === "agreements" && c.key === "company_id");
    const agreementStatusFilter = eqCalls.find((c) => c.table === "agreements" && c.key === "status");
    const daymapFilter = eqCalls.find((c) => c.table === "v_company_current_agreement_daymap" && c.key === "company_id");

    expect(agreementFilter?.value).toBe("cA");
    expect(agreementStatusFilter?.value).toBe("ACTIVE");
    expect(daymapFilter).toBeUndefined();
  });

  test("ACTIVE agreement is active even when starts_at and delivery days are missing", async () => {
    mockAgreement = {
      ...defaultAgreement,
      delivery_days: null,
      starts_at: null,
    };

    const res = await getCurrentAgreementState({ rid: "rid_active_null_start" });

    expect(res.ok).toBe(true);
    expect(res.status).toBe("ACTIVE");
    expect(res.agreementId).toBe("ag_a");
    expect(res.startDate).toBeNull();
  });
});
