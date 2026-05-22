import { beforeEach, describe, expect, test, vi } from "vitest";

const {
  ensureCompanyCustomerMock,
  ensureProviderProductMock,
  ensureProviderVatCodeMock,
  TripletexClientError,
} = vi.hoisted(() => {
  class TripletexClientError extends Error {
    readonly kind: string;
    constructor(input: { message: string; kind: string }) {
      super(input.message);
      this.name = "TripletexClientError";
      this.kind = input.kind;
    }
  }

  return {
    ensureCompanyCustomerMock: vi.fn(),
    ensureProviderProductMock: vi.fn(),
    ensureProviderVatCodeMock: vi.fn(),
    TripletexClientError,
  };
});

vi.mock("@/lib/integrations/tripletex/client", () => ({
  ensureCompanyCustomer: (...args: unknown[]) => ensureCompanyCustomerMock(...args),
  ensureProviderProduct: (...args: unknown[]) => ensureProviderProductMock(...args),
  ensureProviderVatCode: (...args: unknown[]) => ensureProviderVatCodeMock(...args),
  classifyTripletexError: (error: unknown) => error,
  TripletexClientError,
}));

import { handleOnboardingProvisioningStart } from "@/lib/integrations/tripletex/onboardingSync";

const PROVIDER_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const COMPANY_OK = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const COMPANY_SKIP = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const EVENT_KEY = `tripletex.onboarding_provisioning_start:${PROVIDER_ID}:test`;

function createAdminMock() {
  const rpcMock = vi.fn().mockResolvedValue({ error: null });
  const agreements = [{ company_id: COMPANY_OK }, { company_id: COMPANY_SKIP }];
  const companies: Record<string, Record<string, unknown>> = {
    [COMPANY_OK]: {
      id: COMPANY_OK,
      orgnr: "123456789",
      legal_name: "OK Co",
      name: "OK Co",
      billing_email: "a@test.no",
      billing_address: "Gate 1",
      billing_postcode: "7030",
      billing_city: "Trondheim",
      billing_country: "NO",
      ehf_enabled: false,
      ehf_endpoint: null,
    },
    [COMPANY_SKIP]: {
      id: COMPANY_SKIP,
      orgnr: "",
      legal_name: "Skip Co",
      name: "Skip Co",
    },
  };

  return {
    rpc: rpcMock,
    from: (table: string) => {
      if (table === "billing_tax_codes") {
        return {
          select: () => ({
            in: async (_col: string, rates: number[]) => ({
              data: [
                { id: "tax-25", rate: 0.25 },
                { id: "tax-15", rate: 0.15 },
                { id: "tax-0", rate: 0 },
              ],
              error: null,
            }),
          }),
        };
      }
      if (table === "agreements") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: agreements, error: null }),
            }),
          }),
        };
      }
      if (table === "companies") {
        let companyId = COMPANY_OK;
        return {
          select: () => ({
            eq: (_col: string, val: string) => {
              companyId = val;
              return {
                maybeSingle: async () => ({
                  data: companies[companyId] ?? null,
                  error: null,
                }),
              };
            },
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
      };
    },
  };
}

describe("handleOnboardingProvisioningStart (TPT-B-7)", () => {
  beforeEach(() => {
    ensureCompanyCustomerMock.mockReset();
    ensureProviderProductMock.mockReset();
    ensureProviderVatCodeMock.mockReset();
    ensureProviderVatCodeMock.mockResolvedValue({ vatTypeId: 1, vatCode: "3" });
    ensureProviderProductMock.mockResolvedValue({ productId: "100", vatCode: "3", created: true });
    ensureCompanyCustomerMock.mockResolvedValue({ customerId: "9001", created: true });
  });

  test("happy: ensures complete, RPC called with summary", async () => {
    const admin = createAdminMock();
    const result = await handleOnboardingProvisioningStart(admin, {
      event_key: EVENT_KEY,
      payload: { provider_id: PROVIDER_ID, env: "test", request_rid: "rid-1" },
    });
    expect(result).toEqual({ ok: true });
    expect(ensureProviderVatCodeMock).toHaveBeenCalled();
    expect(ensureProviderProductMock).toHaveBeenCalledTimes(3);
    expect(admin.rpc).toHaveBeenCalledWith(
      "lp_provider_complete_onboarding_provisioning",
      expect.objectContaining({
        p_provider_id: PROVIDER_ID,
        p_env: "test",
      }),
    );
  });

  test("with skipped customers", async () => {
    ensureCompanyCustomerMock.mockResolvedValueOnce({ customerId: "9001", created: true });
    const admin = createAdminMock();
    const result = await handleOnboardingProvisioningStart(admin, {
      event_key: EVENT_KEY,
      payload: { provider_id: PROVIDER_ID, env: "test" },
    });
    expect(result.ok).toBe(true);
    const summary = admin.rpc.mock.calls[0]?.[1]?.p_summary;
    expect(summary?.customers_skipped).toBeGreaterThanOrEqual(1);
  });

  test("Tripletex 401 during ensure → FAILED permanent", async () => {
    ensureProviderVatCodeMock.mockRejectedValueOnce(
      new TripletexClientError({ message: "auth", kind: "AUTH" }),
    );
    const admin = createAdminMock();
    const result = await handleOnboardingProvisioningStart(admin, {
      event_key: EVENT_KEY,
      payload: { provider_id: PROVIDER_ID, env: "test" },
    });
    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(true);
  });

  test("Tripletex 5xx during ensure → PENDING (transient)", async () => {
    ensureProviderVatCodeMock.mockRejectedValueOnce(
      new TripletexClientError({ message: "server", kind: "TRANSIENT" }),
    );
    const admin = createAdminMock();
    const result = await handleOnboardingProvisioningStart(admin, {
      event_key: EVENT_KEY,
      payload: { provider_id: PROVIDER_ID, env: "test" },
    });
    expect(result.ok).toBe(false);
    expect(result.permanent).toBe(false);
  });
});
