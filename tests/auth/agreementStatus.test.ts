import { describe, expect, test } from "vitest";
import { canCompanyOperate, getAgreementStatus } from "@/lib/auth/agreementStatus";

type Seed = {
  agreement?: Record<string, unknown> | null;
  billing?: Record<string, unknown> | null;
  billingError?: unknown;
  billingThrows?: boolean;
};

function makeSupabase(seed: Seed) {
  return {
    from(table: string) {
      const q = {
        select: () => q,
        eq: () => q,
        maybeSingle: async () => {
          if (table === "company_current_agreement") {
            return { data: seed.agreement ?? null, error: null };
          }
          if (table === "company_billing_accounts") {
            if (seed.billingThrows) throw seed.billingError ?? new Error("relation does not exist");
            if (seed.billingError) return { data: null, error: seed.billingError };
            return { data: seed.billing ?? null, error: null };
          }
          return { data: null, error: null };
        },
      };
      return q;
    },
  } as any;
}

describe("agreementStatus", () => {
  test("ACTIVE agreement and no billing hold allows company operations", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "BASIS", status: "ACTIVE" },
        billing: { hold_active: false },
      }),
      "company_1",
    );

    expect(status).toMatchObject({
      agreementId: "ag_1",
      tier: "BASIS",
      status: "ACTIVE",
      isActive: true,
      billingHold: false,
    });
    expect(canCompanyOperate(status)).toBe(true);
  });

  test("ACTIVE agreement with active billing hold blocks company operations", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "LUXUS", status: "ACTIVE" },
        billing: { hold_active: true },
      }),
      "company_1",
    );

    expect(status.isActive).toBe(true);
    expect(status.billingHold).toBe(true);
    expect(canCompanyOperate(status)).toBe(false);
  });

  test("PAUSED agreement is not active", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "BASIS", status: "PAUSED" },
      }),
      "company_1",
    );

    expect(status.status).toBe("PAUSED");
    expect(status.isActive).toBe(false);
    expect(canCompanyOperate(status)).toBe(false);
  });

  test("CLOSED agreement is not active", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "ENTERPRISE", status: "CLOSED" },
      }),
      "company_1",
    );

    expect(status.status).toBe("CLOSED");
    expect(status.isActive).toBe(false);
    expect(canCompanyOperate(status)).toBe(false);
  });

  test("missing agreement returns null agreement id and inactive status", async () => {
    const status = await getAgreementStatus(makeSupabase({ agreement: null }), "company_1");

    expect(status.agreementId).toBeNull();
    expect(status.status).toBeNull();
    expect(status.isActive).toBe(false);
    expect(canCompanyOperate(status)).toBe(false);
  });

  test("missing company_billing_accounts table does not throw and means no billing hold", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "BASIS", status: "ACTIVE" },
        billingThrows: true,
        billingError: { code: "42P01", message: "relation company_billing_accounts does not exist" },
      }),
      "company_1",
    );

    expect(status.isActive).toBe(true);
    expect(status.billingHold).toBe(false);
    expect(canCompanyOperate(status)).toBe(true);
  });
});
