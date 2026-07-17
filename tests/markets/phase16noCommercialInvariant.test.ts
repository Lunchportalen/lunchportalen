import { describe, expect, it } from "vitest";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { MARKET_LOCALES } from "@/lib/markets/supportedMarkets";
import { LAUNCH_CURRENCY_CODES } from "@/lib/money/minorUnits";
import { LP_GLOBAL_COMMISSION_RATE_BPS } from "@/lib/billing/globalCommission";
import { MARKET_COMMERCIAL_MODELS } from "@/lib/markets/commercialModel";
import {
  assertGlobalCommercialModelLocked,
  buildCountryInvariant,
  COMMERCIAL_MODEL_ID,
  norwayPlatformInvoiceExample,
  NORWAY_PLATFORM_INVOICE_WORDING,
} from "@/lib/markets/commercialModelInvariant";
import {
  assertCountryMarketAccess,
  evaluateNorwayFirstReadiness,
  isOtherCountryProductionBlocked,
} from "@/lib/markets/norwayFirstActivation";

describe("Phase 16NO — global commercial model 21 countries", () => {
  it("registry counts: 21 countries, 24 locales, 11 currencies", () => {
    expect(SUPPORTED_COUNTRY_CODES).toHaveLength(21);
    expect(MARKET_LOCALES).toHaveLength(24);
    expect(LAUNCH_CURRENCY_CODES).toHaveLength(11);
  });

  it("locks agency_commission_invoice_only_v1 for all 21", () => {
    assertGlobalCommercialModelLocked();
    expect(COMMERCIAL_MODEL_ID).toBe("agency_commission_invoice_only_v1");
    expect(LP_GLOBAL_COMMISSION_RATE_BPS).toBe(500);
    for (const c of SUPPORTED_COUNTRY_CODES) {
      const inv = buildCountryInvariant(c);
      expect(inv.providerIsFoodSeller).toBe(true);
      expect(inv.providerInvoicesCustomer).toBe(true);
      expect(inv.platformIsFoodSeller).toBe(false);
      expect(inv.platformInvoicesProvider).toBe(true);
      expect(inv.platformCollectsCustomerFunds).toBe(false);
      expect(inv.commissionRateBps).toBe(500);
      expect(inv.commissionBase).toBe("net_excluding_customer_tax");
      expect(inv.paymentMode).toBe("invoice_only");
      expect(inv.stripeEnabled).toBe(false);
      expect(MARKET_COMMERCIAL_MODELS[c].platformRole).toBe("disclosed_agent");
      expect(MARKET_COMMERCIAL_MODELS[c].invoiceIssuer).toBe("provider");
      expect(MARKET_COMMERCIAL_MODELS[c].commissionBps).toBe(500);
    }
  });

  it("blocks non-Norway production and keeps other countries disabled", () => {
    for (const c of SUPPORTED_COUNTRY_CODES) {
      if (c === "NO") continue;
      expect(isOtherCountryProductionBlocked(c)).toBe(true);
      expect(buildCountryInvariant(c).productionEnabled).toBe(false);
      expect(() => assertCountryMarketAccess(c, "order")).toThrow(/COUNTRY_PRODUCTION_DISABLED/);
    }
  });

  it("Norway fiscal path requires accountant confirmation", () => {
    delete process.env.ACCOUNTANT_NORWAY_TAX_CONFIRMATION;
    delete process.env.COUNTRY_NO_PRODUCTION_ENABLED;
    const readiness = evaluateNorwayFirstReadiness();
    expect(readiness.decision).toBe("NORWAY_READY_ACCOUNTANT_CONFIRMATION_REQUIRED");
    expect(readiness.otherCountriesDisabled).toBe(20);
    expect(() => assertCountryMarketAccess("NO", "order")).toThrow(/ACCOUNTANT_NORWAY_TAX_CONFIRMATION_REQUIRED/);
  });

  it("Norway platform invoice example: 10000 → 500 + 125 = 625", () => {
    // NOK minor units: 10_000.00 = 1_000_000
    const ex = norwayPlatformInvoiceExample(BigInt(1_000_000));
    expect(ex.customerNetMinor).toBe(BigInt(1_000_000));
    expect(ex.foodMvaMinor).toBe(BigInt(150_000));
    expect(ex.customerGrossMinor).toBe(BigInt(1_150_000));
    expect(ex.commissionNetMinor).toBe(BigInt(50_000));
    expect(ex.commissionMvaMinor).toBe(BigInt(12_500));
    expect(ex.platformInvoiceTotalMinor).toBe(BigInt(62_500));
    expect(ex.taxCode).toBe("NO_PLATFORM_SERVICE_STANDARD_VAT_25");
    expect(NORWAY_PLATFORM_INVOICE_WORDING).toContain("5 %");
    // Must NOT be 5% of gross 11500
    expect(ex.commissionNetMinor).not.toBe(BigInt(57_500));
  });
});
