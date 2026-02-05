// tests/tenant-isolation-currentAgreement.test.ts
// @ts-nocheck
import { describe, test, expect, vi, beforeEach } from "vitest";

let eqCalls: Array<{ table: string; key: string; value: string }> = [];

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
          if (table === "company_current_agreement") {
            return {
              data: {
                id: "ag_a",
                company_id: "cA",
                status: "ACTIVE",
                delivery_days: ["mon", "tue"],
                plan_tier: "BASIS",
                price_per_cuvert_nok: 95,
                start_date: "2026-01-01",
                end_date: null,
                updated_at: "2026-01-31T12:00:00Z",
              },
              error: null,
            };
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

import { getCurrentAgreementState } from "../lib/agreement/currentAgreement";

beforeEach(() => {
  eqCalls = [];
});

describe("tenant isolation – currentAgreement", () => {
  test("company_id is always filtered for agreement and daymap", async () => {
    const res = await getCurrentAgreementState({ rid: "rid_test" });
    expect(res.ok).toBe(true);

    const agreementFilter = eqCalls.find((c) => c.table === "company_current_agreement" && c.key === "company_id");
    const daymapFilter = eqCalls.find((c) => c.table === "v_company_current_agreement_daymap" && c.key === "company_id");

    expect(agreementFilter?.value).toBe("cA");
    expect(daymapFilter?.value).toBe("cA");
  });
});
