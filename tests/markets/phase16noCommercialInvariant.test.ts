import { describe, expect, it, beforeEach, afterEach } from "vitest";
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
  assertPlatformMvaInvoiceAllowed,
  evaluateNorwayFirstReadiness,
  isOtherCountryProductionBlocked,
  NORWAY_TAX_MODEL_STATUS,
} from "@/lib/markets/norwayFirstActivation";

const OWNER_ENV = [
  "OWNER_NORWAY_TAX_MODEL_CONFIRMATION",
  "OWNER_ACCEPTS_NORWAY_TAX_CLASSIFICATION_RESPONSIBILITY",
  "ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER",
  "ACCOUNTANT_NORWAY_TAX_CONFIRMATION",
  "COUNTRY_NO_PRODUCTION_ENABLED",
  "COUNTRY_NO_REGISTRATION_ENABLED",
  "COUNTRY_NO_ORDERING_ENABLED",
  "COUNTRY_NO_INVOICE_ONLY_ENABLED",
  "COUNTRY_NO_PLATFORM_COMMISSION_ENABLED",
  "LUNCHPORTALEN_MVA_REGISTERED",
  "PLATFORM_INVOICE_VAT_25_ENABLED",
] as const;

const saved: Record<string, string | undefined> = {};

describe("Phase 16NO — global commercial model 21 countries", () => {
  beforeEach(() => {
    for (const k of OWNER_ENV) saved[k] = process.env[k];
  });
  afterEach(() => {
    for (const k of OWNER_ENV) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

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

  it("owner waiver unblocks Norway cutover; accountant is not required", () => {
    process.env.OWNER_NORWAY_TAX_MODEL_CONFIRMATION = "CONFIRMED";
    process.env.OWNER_ACCEPTS_NORWAY_TAX_CLASSIFICATION_RESPONSIBILITY = "YES";
    process.env.ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER = "YES";
    process.env.ACCOUNTANT_NORWAY_TAX_CONFIRMATION = "NOT_REQUIRED_FOR_CUTOVER";
    process.env.COUNTRY_NO_PRODUCTION_ENABLED = "true";
    process.env.COUNTRY_NO_ORDERING_ENABLED = "true";
    process.env.COUNTRY_NO_REGISTRATION_ENABLED = "true";
    process.env.COUNTRY_NO_INVOICE_ONLY_ENABLED = "true";
    process.env.COUNTRY_NO_PLATFORM_COMMISSION_ENABLED = "true";
    process.env.LUNCHPORTALEN_MVA_REGISTERED = "false";
    process.env.PLATFORM_INVOICE_VAT_25_ENABLED = "false";

    const readiness = evaluateNorwayFirstReadiness();
    expect(readiness.accountantConfirmationRequired).toBe(false);
    expect(readiness.norwayTaxModelStatus).toBe(NORWAY_TAX_MODEL_STATUS);
    expect(readiness.decision).toBe("NORWAY_TECHNICALLY_LIVE_PLATFORM_INVOICING_AWAITS_MVA_REGISTRATION");
    expect(readiness.otherCountriesDisabled).toBe(20);
    expect(() => assertCountryMarketAccess("NO", "order")).not.toThrow();
    expect(() => assertPlatformMvaInvoiceAllowed()).toThrow(/PLATFORM_MVA_INVOICE_REQUIRES_MVA_REGISTRATION/);
  });

  it("Norway platform invoice example: 10000 → 500 + 125 = 625", () => {
    const ex = norwayPlatformInvoiceExample(BigInt(1_000_000));
    expect(ex.customerNetMinor).toBe(BigInt(1_000_000));
    expect(ex.foodMvaMinor).toBe(BigInt(150_000));
    expect(ex.customerGrossMinor).toBe(BigInt(1_150_000));
    expect(ex.commissionNetMinor).toBe(BigInt(50_000));
    expect(ex.commissionMvaMinor).toBe(BigInt(12_500));
    expect(ex.platformInvoiceTotalMinor).toBe(BigInt(62_500));
    expect(ex.taxCode).toBe("NO_PLATFORM_SERVICE_STANDARD_VAT_25");
    expect(NORWAY_PLATFORM_INVOICE_WORDING).toContain("5 %");
    expect(ex.commissionNetMinor).not.toBe(BigInt(57_500));
  });
});
