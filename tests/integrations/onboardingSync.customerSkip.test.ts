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
const COMPANY_MISSING = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const COMPANY_DB_ERROR = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const EVENT_KEY = `tripletex.onboarding_provisioning_start:${PROVIDER_ID}:test`;

function createAdminMock(options: {
  companyError?: { code: string; message: string } | null;
  companyMissing?: boolean;
}) {
  const rpcMock = vi.fn().mockResolvedValue({ error: null });
  const agreements = options.companyMissing
    ? [{ company_id: COMPANY_MISSING }]
    : [{ company_id: COMPANY_DB_ERROR }];

  return {
    rpc: rpcMock,
    from: (table: string) => {
      if (table === "billing_tax_codes") {
        return {
          select: () => ({
            in: async () => ({
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
        let companyId = COMPANY_DB_ERROR;
        return {
          select: () => ({
            eq: (_col: string, val: string) => {
              companyId = val;
              return {
                maybeSingle: async () => {
                  if (companyId === COMPANY_DB_ERROR && options.companyError) {
                    return { data: null, error: options.companyError };
                  }
                  if (companyId === COMPANY_MISSING || options.companyMissing) {
                    return { data: null, error: null };
                  }
                  return {
                    data: {
                      id: companyId,
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
                    error: null,
                  };
                },
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

describe("handleOnboardingProvisioningStart customer skip reasons (polish-5)", () => {
  beforeEach(() => {
    ensureCompanyCustomerMock.mockReset();
    ensureProviderProductMock.mockReset();
    ensureProviderVatCodeMock.mockReset();
    ensureProviderVatCodeMock.mockResolvedValue({ vatTypeId: 1, vatCode: "3" });
    ensureProviderProductMock.mockResolvedValue({ productId: "100", vatCode: "3", created: true });
    ensureCompanyCustomerMock.mockResolvedValue({ customerId: "9001", created: true });
  });

  test("companies DB error → COMPANY_LOOKUP_FAILED with error_code", async () => {
    const admin = createAdminMock({
      companyError: {
        code: "42703",
        message: 'column "legal_name" does not exist',
      },
    });

    const result = await handleOnboardingProvisioningStart(admin, {
      event_key: EVENT_KEY,
      payload: { provider_id: PROVIDER_ID, env: "test" },
    });

    expect(result.ok).toBe(true);
    const summary = admin.rpc.mock.calls[0]?.[1]?.p_summary;
    const lookupFailed = summary?.skipped_details?.find(
      (s: { reason: string }) => s.reason === "COMPANY_LOOKUP_FAILED",
    );
    expect(lookupFailed).toMatchObject({
      company_id: COMPANY_DB_ERROR,
      reason: "COMPANY_LOOKUP_FAILED",
      error_code: "42703",
      error_message: 'column "legal_name" does not exist',
    });
  });

  test("company not found (0 rows) → COMPANY_NOT_FOUND without error_code", async () => {
    const admin = createAdminMock({ companyMissing: true });

    const result = await handleOnboardingProvisioningStart(admin, {
      event_key: EVENT_KEY,
      payload: { provider_id: PROVIDER_ID, env: "test" },
    });

    expect(result.ok).toBe(true);
    const summary = admin.rpc.mock.calls[0]?.[1]?.p_summary;
    const notFound = summary?.skipped_details?.find(
      (s: { reason: string }) => s.reason === "COMPANY_NOT_FOUND",
    );
    expect(notFound).toMatchObject({
      company_id: COMPANY_MISSING,
      reason: "COMPANY_NOT_FOUND",
    });
    expect(notFound?.error_code).toBeUndefined();
    expect(notFound?.error_message).toBeUndefined();
  });
});
