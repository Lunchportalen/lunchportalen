import { describe, expect, test, vi } from "vitest";
import { canCompanyOperate, getAgreementStatus } from "@/lib/auth/agreementStatus";

type Seed = {
  agreement?: Record<string, unknown> | null;
  agreementError?: unknown;
  dayRows?: Array<Record<string, unknown>>;
  dayError?: unknown;
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
            if (seed.agreementError) return { data: null, error: seed.agreementError };
            return { data: seed.agreement ?? null, error: null };
          }
          if (table === "company_billing_accounts") {
            if (seed.billingThrows) throw seed.billingError ?? new Error("relation does not exist");
            if (seed.billingError) return { data: null, error: seed.billingError };
            return { data: seed.billing ?? null, error: null };
          }
          return { data: null, error: null };
        },
        then: (resolve: any, reject: any) => {
          if (table === "agreement_delivery_days") {
            return Promise.resolve({ data: seed.dayRows ?? [], error: seed.dayError ?? null }).then(resolve, reject);
          }
          return Promise.resolve({ data: null, error: null }).then(resolve, reject);
        },
      };
      return q;
    },
  } as any;
}

const nullDayTiers = {
  mon: null,
  tue: null,
  wed: null,
  thu: null,
  fri: null,
};

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

  test("logger warning ved 42501 RLS error på company_current_agreement", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const status = await getAgreementStatus(
      makeSupabase({
        agreementError: { code: "42501", message: "permission denied for view" },
      }),
      "test-company-id",
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      "[agreementStatus] RLS/GRANT issue on company_current_agreement",
      expect.objectContaining({
        companyId: "test-company-id",
        code: "42501",
      }),
    );
    expect(status.agreementId).toBeNull();
    expect(status.tier).toBeNull();

    consoleSpy.mockRestore();
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

  test("fail-closed når company_billing_accounts mangler (PGRST205)", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "BASIS", status: "ACTIVE" },
        billingError: {
          code: "PGRST205",
          message: "Could not find the table 'public.company_billing_accounts' in the schema cache",
        },
      }),
      "company_1",
    );

    expect(status.billingHold).toBe(false);
  });

  test("fail-closed når company_billing_accounts har 42P01", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "BASIS", status: "ACTIVE" },
        billingError: { code: "42P01", message: 'relation "public.company_billing_accounts" does not exist' },
      }),
      "company_1",
    );

    expect(status.billingHold).toBe(false);
  });

  test("fail-closed når company_billing_accounts har ukjent feilkode", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "BASIS", status: "ACTIVE" },
        billingError: { code: "UNKNOWN", message: "network timeout" },
      }),
      "company_1",
    );

    expect(status.billingHold).toBe(true);
  });

  test("leser blandet tier fra agreement_delivery_days", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "ENTERPRISE", status: "ACTIVE" },
        dayRows: [
          { weekday: "mon", tier: "BASIS" },
          { weekday: "tue", tier: "BASIS" },
          { weekday: "wed", tier: "LUXUS" },
          { weekday: "thu", tier: "BASIS" },
          { weekday: "fri", tier: "LUXUS" },
        ],
      }),
      "company_1",
    );

    expect(status.dayTiers).toEqual({
      mon: "BASIS",
      tue: "BASIS",
      wed: "LUXUS",
      thu: "BASIS",
      fri: "LUXUS",
    });
    expect(status.tier).toBe("BASIS");
  });

  test("håndterer alle BASIS", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "LUXUS", status: "ACTIVE" },
        dayRows: [
          { weekday: "mon", tier: "BASIS" },
          { weekday: "tue", tier: "BASIS" },
          { weekday: "wed", tier: "BASIS" },
          { weekday: "thu", tier: "BASIS" },
          { weekday: "fri", tier: "BASIS" },
        ],
      }),
      "company_1",
    );

    expect(status.dayTiers).toEqual({
      mon: "BASIS",
      tue: "BASIS",
      wed: "BASIS",
      thu: "BASIS",
      fri: "BASIS",
    });
    expect(status.tier).toBe("BASIS");
  });

  test("håndterer ENTERPRISE i blandingen", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "BASIS", status: "ACTIVE" },
        dayRows: [
          { weekday: "mon", tier: "BASIS" },
          { weekday: "tue", tier: "BASIS" },
          { weekday: "wed", tier: "ENTERPRISE" },
          { weekday: "thu", tier: "LUXUS" },
          { weekday: "fri", tier: "ENTERPRISE" },
        ],
      }),
      "company_1",
    );

    expect(status.dayTiers).toEqual({
      mon: "BASIS",
      tue: "BASIS",
      wed: "ENTERPRISE",
      thu: "LUXUS",
      fri: "ENTERPRISE",
    });
    expect(status.tier).toBe("ENTERPRISE");
  });

  test("fail-closed når tier-kolonnen mangler (42703)", async () => {
    await expect(
      getAgreementStatus(
        makeSupabase({
          agreement: { agreement_id: "ag_1", tier: "LUXUS", status: "ACTIVE" },
          dayError: { code: "42703", message: "column tier does not exist" },
        }),
        "company_1",
      ),
    ).resolves.toMatchObject({
      dayTiers: nullDayTiers,
      tier: "LUXUS",
    });
  });

  test("fail-closed når agreement_delivery_days-relasjonen mangler (42P01)", async () => {
    await expect(
      getAgreementStatus(
        makeSupabase({
          agreement: { agreement_id: "ag_1", tier: "BASIS", status: "ACTIVE" },
          dayError: { code: "42P01", message: "relation does not exist" },
        }),
        "company_1",
      ),
    ).resolves.toMatchObject({
      dayTiers: nullDayTiers,
      tier: "BASIS",
    });
  });

  test("fail-closed når dayRows er tomt", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "ENTERPRISE", status: "ACTIVE" },
        dayRows: [],
      }),
      "company_1",
    );

    expect(status.dayTiers).toEqual(nullDayTiers);
    expect(status.tier).toBe("ENTERPRISE");
  });

  test("filtrerer ugyldige weekday-verdier", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "BASIS", status: "ACTIVE" },
        dayRows: [
          { weekday: "mon", tier: "BASIS" },
          { weekday: "sat", tier: "BASIS" },
          { weekday: "INVALID", tier: "BASIS" },
        ],
      }),
      "company_1",
    );

    expect(status.dayTiers).toEqual({
      mon: "BASIS",
      tue: null,
      wed: null,
      thu: null,
      fri: null,
    });
    expect(status.tier).toBe("BASIS");
  });

  test("filtrerer ugyldige tier-verdier", async () => {
    const status = await getAgreementStatus(
      makeSupabase({
        agreement: { agreement_id: "ag_1", tier: "BASIS", status: "ACTIVE" },
        dayRows: [
          { weekday: "mon", tier: "premium" },
          { weekday: "tue", tier: null },
        ],
      }),
      "company_1",
    );

    expect(status.dayTiers).toEqual(nullDayTiers);
    expect(status.tier).toBe("BASIS");
  });
});
