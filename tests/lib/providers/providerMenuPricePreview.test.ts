import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

import { loadProviderMenuPrices } from "@/lib/providers/providerMenuPriceConfig";
import { loadProviderMenuPricesPreview } from "@/lib/providers/providerMenuPricePreview";

type QueryResult = { data: unknown[] | null; error: { message?: string } | null };

function mockPreviewQuery(result: QueryResult) {
  const terminal = async () => result;
  mockFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              is: () => ({
                is: () => ({
                  is: () => ({
                    not: terminal,
                  }),
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  });
}

const NO_ROW_FIXTURE = [
  {
    tier: "BASIS",
    amount_ex_vat: 95,
    vat_rate: 0.15,
    currency: "NOK",
    tax_basis: "ex_tax",
    tax_category: "food_catering",
    source: "seed",
    market_code: "NO",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_to: null,
  },
  {
    tier: "LUXUS",
    amount_ex_vat: 135,
    vat_rate: 0.15,
    currency: "NOK",
    tax_basis: "ex_tax",
    tax_category: "food_catering",
    source: "seed",
    market_code: "NO",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_to: null,
  },
  {
    tier: "ENTERPRISE",
    amount_ex_vat: 175,
    vat_rate: 0.15,
    currency: "NOK",
    tax_basis: "ex_tax",
    tax_category: "food_catering",
    source: "seed",
    market_code: "NO",
    valid_from: "2026-01-01T00:00:00.000Z",
    valid_to: null,
  },
];

describe("loadProviderMenuPricesPreview", () => {
  beforeEach(() => {
    mockFrom.mockReset();
  });

  it("reads NO market rows with full metadata", async () => {
    mockPreviewQuery({ data: NO_ROW_FIXTURE, error: null });

    const result = await loadProviderMenuPricesPreview("provider-1");

    expect(result.diagnostics.preview).toBe(true);
    expect(result.diagnostics.resolverVersion).toBe("r4d-preview-v1");
    expect(result.diagnostics.marketCode).toBe("NO");
    expect(result.diagnostics.aggregateSource).toBe("provider_price_rules_market");
    expect(result.diagnostics.dbRowCount).toBe(3);
    expect(result.diagnostics.tiersFromMarket).toBe(3);

    expect(result.tiers.BASIS.source).toBe("provider_price_rules_market");
    expect(result.tiers.BASIS.amountExVat).toBe(95);
    expect(result.tiers.BASIS.currency).toBe("NOK");
    expect(result.tiers.BASIS.taxBasis).toBe("ex_tax");
    expect(result.tiers.BASIS.taxCategory).toBe("food_catering");
    expect(result.tiers.BASIS.rowSource).toBe("seed");
    expect(result.tiers.BASIS.marketCode).toBe("NO");
    expect(result.tiers.BASIS.priceIncVatNok).toBe(109.25);
  });

  it("falls back when no rows exist", async () => {
    mockPreviewQuery({ data: [], error: null });

    const result = await loadProviderMenuPricesPreview("provider-2");

    expect(result.diagnostics.aggregateSource).toBe("fallback_tier_pricing");
    expect(result.diagnostics.tiersFromFallback).toBe(3);
    expect(result.tiers.BASIS.source).toBe("fallback_tier_pricing");
    expect(result.tiers.BASIS.currency).toBe("NOK");
    expect(result.tiers.BASIS.amountExVat).toBe(90);
    expect(result.tiers.ENTERPRISE.amountExVat).toBe(170);
  });

  it("skips invalid rows and falls back affected tiers", async () => {
    mockPreviewQuery({
      data: [
        { tier: "BASIS", amount_ex_vat: 95, vat_rate: 0.15, currency: "NOK", market_code: "NO" },
        { tier: "NOT_A_TIER", amount_ex_vat: 50, vat_rate: 0.15, currency: "NOK", market_code: "NO" },
        { tier: "LUXUS", amount_ex_vat: 0, vat_rate: 0.15, currency: "NOK", market_code: "NO" },
        {
          tier: "ENTERPRISE",
          amount_ex_vat: 175,
          vat_rate: 0.15,
          currency: "NOK",
          tax_basis: "ex_tax",
          market_code: "NO",
        },
      ],
      error: null,
    });

    const result = await loadProviderMenuPricesPreview("provider-3");

    expect(result.diagnostics.skippedInvalidRows).toBe(2);
    expect(result.diagnostics.aggregateSource).toBe("mixed");
    expect(result.tiers.BASIS.source).toBe("provider_price_rules_market");
    expect(result.tiers.LUXUS.source).toBe("fallback_tier_pricing");
    expect(result.tiers.LUXUS.amountExVat).toBe(130);
    expect(result.tiers.ENTERPRISE.source).toBe("provider_price_rules_market");
  });

  it("falls back on DB error with diagnostics.queryError", async () => {
    mockPreviewQuery({ data: null, error: { message: "connection refused" } });

    const result = await loadProviderMenuPricesPreview("provider-4");

    expect(result.diagnostics.queryError).toBe("connection refused");
    expect(result.diagnostics.aggregateSource).toBe("fallback_tier_pricing");
    expect(result.tiers.BASIS.source).toBe("fallback_tier_pricing");
  });

  it("matches production amount/vat/inc-vat for normal NO rows", async () => {
    mockPreviewQuery({ data: NO_ROW_FIXTURE, error: null });
    const preview = await loadProviderMenuPricesPreview("provider-parity");

    mockFrom.mockReset();
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            is: () => ({
              is: () => ({
                not: async () => ({
                  data: NO_ROW_FIXTURE.map(({ tier, amount_ex_vat, vat_rate }) => ({
                    tier,
                    amount_ex_vat,
                    vat_rate,
                  })),
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    });
    const production = await loadProviderMenuPrices("provider-parity");

    for (const tier of ["BASIS", "LUXUS", "ENTERPRISE"] as const) {
      expect(preview.tiers[tier].amountExVat).toBe(production[tier].priceExVatNok);
      expect(preview.tiers[tier].vatRate).toBe(production[tier].vatRate);
      expect(preview.tiers[tier].priceIncVatNok).toBe(production[tier].priceIncVatNok);
    }
  });

  it("falls back for empty providerId", async () => {
    const result = await loadProviderMenuPricesPreview("  ");

    expect(result.diagnostics.aggregateSource).toBe("fallback_tier_pricing");
    expect(result.diagnostics.providerId).toBe("");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  describe("R4F edge cases (contract — resolver unchanged)", () => {
    it("uses NO market rows only (SE excluded at DB query)", async () => {
      mockPreviewQuery({
        data: [
          {
            tier: "BASIS",
            amount_ex_vat: 95,
            vat_rate: 0.15,
            currency: "NOK",
            tax_basis: "ex_tax",
            tax_category: "food_catering",
            source: "seed",
            market_code: "NO",
            valid_from: null,
            valid_to: null,
          },
        ],
        error: null,
      });

      const result = await loadProviderMenuPricesPreview("provider-no-only");

      expect(result.tiers.BASIS.amountExVat).toBe(95);
      expect(result.tiers.BASIS.marketCode).toBe("NO");
      expect(result.tiers.BASIS.source).toBe("provider_price_rules_market");
    });

    it("falls back when NO query returns empty (e.g. SE-only provider at DB)", async () => {
      mockPreviewQuery({ data: [], error: null });

      const result = await loadProviderMenuPricesPreview("provider-se-only");

      expect(result.diagnostics.aggregateSource).toBe("fallback_tier_pricing");
      expect(result.tiers.BASIS.amountExVat).toBe(90);
      expect(result.tiers.BASIS.source).toBe("fallback_tier_pricing");
    });

    it("falls back tier when no tier-default rows (override-only excluded at DB)", async () => {
      mockPreviewQuery({ data: [], error: null });

      const result = await loadProviderMenuPricesPreview("provider-override-only");

      expect(result.diagnostics.tiersFromMarket).toBe(0);
      expect(result.tiers.LUXUS.source).toBe("fallback_tier_pricing");
      expect(result.tiers.LUXUS.amountExVat).toBe(130);
    });

    it("mixed aggregateSource when only some NO tiers have DB rows", async () => {
      mockPreviewQuery({
        data: [
          {
            tier: "BASIS",
            amount_ex_vat: 95,
            vat_rate: 0.15,
            currency: "NOK",
            tax_basis: "ex_tax",
            market_code: "NO",
          },
        ],
        error: null,
      });

      const result = await loadProviderMenuPricesPreview("provider-partial-no");

      expect(result.diagnostics.aggregateSource).toBe("mixed");
      expect(result.tiers.BASIS.source).toBe("provider_price_rules_market");
      expect(result.tiers.LUXUS.source).toBe("fallback_tier_pricing");
      expect(result.tiers.ENTERPRISE.source).toBe("fallback_tier_pricing");
    });
  });
});
