import { beforeEach, describe, expect, test, vi } from "vitest";

const { ensureProviderVatCodeMock } = vi.hoisted(() => ({
  ensureProviderVatCodeMock: vi.fn(),
}));

vi.mock("@/lib/integrations/tripletex/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/tripletex/client")>();
  return {
    ...actual,
    ensureCompanyCustomer: vi.fn().mockResolvedValue({ customerId: "1", created: true }),
    ensureProviderProduct: vi.fn().mockResolvedValue({ productId: "1", vatCode: "3", created: true }),
    ensureProviderVatCode: (...args: unknown[]) => ensureProviderVatCodeMock(...args),
    classifyTripletexError: (error: unknown) => error,
    TripletexClientError: actual.TripletexClientError,
  };
});

import {
  handleOnboardingProvisioningStart,
  REQUIRED_VAT_RATES,
} from "@/lib/integrations/tripletex/onboardingSync";

const PROVIDER_ID = "742c7d6c-3632-4362-a665-da0e415aab8c";

describe("onboarding billing_tax_codes decimal rate lookup (TPT-B-7b-hotfix-7)", () => {
  let inRates: number[] | null = null;

  beforeEach(() => {
    inRates = null;
    ensureProviderVatCodeMock.mockReset();
    ensureProviderVatCodeMock.mockResolvedValue({ vatTypeId: 3, vatCode: "3" });
  });

  function createAdmin() {
    return {
      rpc: vi.fn().mockResolvedValue({ error: null }),
      from: (table: string) => {
        if (table === "billing_tax_codes") {
          return {
            select: () => ({
              in: (_col: string, rates: number[]) => {
                inRates = rates;
                return Promise.resolve({
                  data: [
                    { id: "MVA_25", rate: 0.25 },
                    { id: "MVA_15", rate: 0.15 },
                    { id: "MVA_0", rate: 0 },
                  ],
                  error: null,
                });
              },
            }),
          };
        }
        if (table === "agreements") {
          return {
            select: () => ({
              eq: () => ({
                eq: async () => ({ data: [], error: null }),
              }),
            }),
          };
        }
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        };
      },
    };
  }

  test("REQUIRED_VAT_RATES er decimal, ikke whole percent", () => {
    expect(REQUIRED_VAT_RATES).toEqual([0.25, 0.15, 0]);
  });

  test("lookup bruker decimal rates og kaller ensureProviderVatCode for alle tre", async () => {
    const admin = createAdmin();
    const result = await handleOnboardingProvisioningStart(admin, {
      event_key: `tripletex.onboarding_provisioning_start:${PROVIDER_ID}:test`,
      payload: { provider_id: PROVIDER_ID, env: "test" },
    });

    expect(result.ok).toBe(true);
    expect(inRates).toEqual([0.25, 0.15, 0]);
    expect(ensureProviderVatCodeMock).toHaveBeenCalledTimes(3);
    expect(ensureProviderVatCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ taxCodeId: "MVA_25" }),
    );
    expect(ensureProviderVatCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ taxCodeId: "MVA_15" }),
    );
    expect(ensureProviderVatCodeMock).toHaveBeenCalledWith(
      expect.objectContaining({ taxCodeId: "MVA_0" }),
    );
  });
});
