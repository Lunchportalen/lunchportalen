import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

import {
  computeMarginEstimate,
  validateEnterprisePublish,
  weekDatesFromStart,
} from "@/lib/providers/providerMenuPackageSurface";
import {
  fallbackProviderMenuPrices,
  computePriceIncVatNok,
  loadProviderMenuPrices,
} from "@/lib/providers/providerMenuPriceConfig";
import {
  formatPriceExVatLabel,
  formatPriceIncVatLabel,
} from "@/lib/providers/providerMenuPriceDisplay";

describe("providerMenuPriceConfig fallback", () => {
  it("Basis price shows 90 eks. mva / 103,50 inkl. mva", () => {
    const prices = fallbackProviderMenuPrices();
    expect(prices.BASIS.priceExVatNok).toBe(90);
    expect(prices.BASIS.priceIncVatNok).toBe(103.5);
    expect(prices.BASIS.vatRate).toBe(0.15);
    expect(prices.BASIS.source).toBe("fallback");
  });

  it("Luxus price shows 130 eks. mva / 149,50 inkl. mva", () => {
    const prices = fallbackProviderMenuPrices();
    expect(prices.LUXUS.priceExVatNok).toBe(130);
    expect(prices.LUXUS.priceIncVatNok).toBe(149.5);
  });

  it("Enterprise price shows 170 eks. mva / 195,50 inkl. mva", () => {
    const prices = fallbackProviderMenuPrices();
    expect(prices.ENTERPRISE.priceExVatNok).toBe(170);
    expect(prices.ENTERPRISE.priceIncVatNok).toBe(195.5);
  });

  it("VAT labels always shown", () => {
    expect(formatPriceExVatLabel(90)).toContain("eks. mva");
    expect(formatPriceIncVatLabel(103.5)).toContain("inkl. mva");
  });

  it("computePriceIncVatNok uses 15 % VAT", () => {
    expect(computePriceIncVatNok(90, 0.15)).toBe(103.5);
  });

  it("loadProviderMenuPrices reads provider_price_rules when present", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              is: () => ({
                not: async () => ({
                  data: [
                    { tier: "BASIS", amount_ex_vat: 95, vat_rate: 0.15 },
                    { tier: "LUXUS", amount_ex_vat: 135, vat_rate: 0.15 },
                    { tier: "ENTERPRISE", amount_ex_vat: 175, vat_rate: 0.15 },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const prices = await loadProviderMenuPrices("provider-1");
    expect(prices.BASIS.priceExVatNok).toBe(95);
    expect(prices.BASIS.source).toBe("provider_price_rules");
    expect(prices.LUXUS.priceExVatNok).toBe(135);
    expect(prices.ENTERPRISE.priceExVatNok).toBe(175);
  });

  it("fallback prices only used when provider config missing", async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              is: () => ({
                not: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    });

    const prices = await loadProviderMenuPrices("provider-2");
    expect(prices.BASIS.source).toBe("fallback");
    expect(prices.BASIS.priceExVatNok).toBe(90);
    expect(prices.ENTERPRISE.priceIncVatNok).toBe(195.5);
  });
});

describe("providerMenuPackageSurface enterprise validation", () => {
  it("Enterprise with copied Luxus requires upgrade note/type on publish", () => {
    const warnings = validateEnterprisePublish({
      tier: "ENTERPRISE",
      mealTitle: "Premium bowl",
      description: "Med dessert",
      sourcePackage: "LUXUS",
      upgradeType: null,
      upgradeNote: "",
      estimatedCostPerPortion: 40,
      luxusEstimatedCost: 35,
      priceExVatNok: 170,
    });
    expect(warnings.some((w) => w.code === "UPGRADE_REQUIRED" && w.blocking)).toBe(true);
  });

  it("Enterprise warns on weak value proposition without source", () => {
    const warnings = validateEnterprisePublish({
      tier: "ENTERPRISE",
      mealTitle: "Samme rett",
      description: "Uten upgrade",
      sourcePackage: null,
      upgradeType: null,
      upgradeNote: "",
      estimatedCostPerPortion: null,
      luxusEstimatedCost: null,
      priceExVatNok: 170,
    });
    expect(warnings.some((w) => w.code === "WEAK_VALUE")).toBe(true);
  });

  it("computeMarginEstimate returns margin percent", () => {
    const margin = computeMarginEstimate({ priceExVatNok: 170, vatRate: 0.15, priceIncVatNok: 195.5 }, 60);
    expect(margin.grossMarginNok).toBe(110);
    expect(margin.marginPercent).toBeCloseTo(64.7, 1);
  });

  it("weekDatesFromStart returns five weekdays", () => {
    const dates = weekDatesFromStart("2026-06-15");
    expect(dates).toHaveLength(5);
    expect(dates[0]).toBe("2026-06-15");
    expect(dates[4]).toBe("2026-06-19");
  });
});
