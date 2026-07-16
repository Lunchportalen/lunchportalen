import { describe, expect, it } from "vitest";
import {
  addMinor,
  applyBps,
  assertSameCurrency,
  LAUNCH_CURRENCY_CODES,
  platformCommissionMinor,
  taxOnExclusiveBase,
} from "@/lib/money/minorUnits";
import { resolveTax, type TaxRuleRecord } from "@/lib/tax/engine/resolver";
import { COUNTRY_TAX_PACKS, assertAllTaxPacksPresent, countTaxPacksByStatus } from "@/lib/tax/packs/countryTaxPacks";
import { MARKET_COMMERCIAL_MODELS, assertCommissionIsFivePercent } from "@/lib/markets/commercialModel";
import { buildLegalPackStubs, countLegalApprovals } from "@/lib/legal/legalPackRegistry";
import {
  assertGlobalActivationReady,
  assertNoShortcutToActive,
  canTransitionBuildState,
} from "@/lib/markets/buildReadiness";
import { SUPPORTED_COUNTRY_CODES, MARKET_LOCALE_CODES } from "@/lib/markets/supportedMarkets";

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const HUNDRED = BigInt(100);
const TEN_THOUSAND = BigInt(10_000);
const FIVE_HUNDRED = BigInt(500);
const FIFTEEN_HUNDRED = BigInt(1500);
const TWENTY_FIVE_HUNDRED = BigInt(2500);

describe("Phase 15G money minor units", () => {
  it("covers 11 launch currencies from market registry", () => {
    expect(LAUNCH_CURRENCY_CODES).toHaveLength(11);
    expect(LAUNCH_CURRENCY_CODES).toContain("EUR");
    expect(LAUNCH_CURRENCY_CODES).toContain("USD");
  });

  it("forbids cross-currency add", () => {
    expect(() => assertSameCurrency("NOK", "EUR")).toThrow(/CROSS_CURRENCY_FORBIDDEN/);
  });

  it("computes 5% commission in minor units", () => {
    const c = platformCommissionMinor(TEN_THOUSAND, "NOK");
    expect(c.amountMinor).toBe(FIVE_HUNDRED);
  });

  it("applies tax bps half-up", () => {
    expect(taxOnExclusiveBase(TEN_THOUSAND, 2500)).toBe(TWENTY_FIVE_HUNDRED);
    expect(applyBps(HUNDRED, 1)).toBe(ZERO);
    expect(
      addMinor({ currencyCode: "EUR", amountMinor: ONE }, { currencyCode: "EUR", amountMinor: TWO }).amountMinor,
    ).toBe(BigInt(3));
  });
});

describe("Phase 15G tax resolver fail-closed", () => {
  const researchedRule: TaxRuleRecord = {
    id: "r1",
    countryCode: "NO",
    jurisdictionPath: "NO",
    taxCategory: "cold_food",
    customerType: "any",
    fulfillmentType: "any",
    rateBps: 1500,
    inclusive: false,
    reverseCharge: false,
    exemptionCode: null,
    taxCode: "NO-FOOD",
    invoiceWordingKey: null,
    evidenceId: "e1",
    validFrom: "2026-01-01",
    validTo: null,
    reviewStatus: "RESEARCHED",
  };

  it("fails when rule is not APPROVED", () => {
    const r = resolveTax({
      countryCode: "NO",
      currencyCode: "NOK",
      taxCategory: "cold_food",
      customerType: "B2B",
      fulfillmentType: "delivery",
      taxableBaseMinor: TEN_THOUSAND,
      taxPointDate: "2026-07-16",
      rules: [researchedRule],
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe("TAX_RULE_NOT_APPROVED");
  });

  it("fails when no rule exists", () => {
    const r = resolveTax({
      countryCode: "SE",
      currencyCode: "SEK",
      taxCategory: "hot_food",
      customerType: "B2C",
      fulfillmentType: "takeaway",
      taxableBaseMinor: BigInt(1000),
      taxPointDate: "2026-07-16",
      rules: [],
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe("TAX_RULE_MISSING");
  });

  it("requires US/CA subdivision", () => {
    const r = resolveTax({
      countryCode: "US",
      currencyCode: "USD",
      taxCategory: "prepared_food",
      customerType: "B2B",
      fulfillmentType: "delivery",
      taxableBaseMinor: BigInt(1000),
      taxPointDate: "2026-07-16",
      rules: [],
    });
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.code).toBe("SUBDIVISION_REQUIRED");
  });

  it("succeeds only for APPROVED effective rules", () => {
    const approved: TaxRuleRecord = { ...researchedRule, reviewStatus: "APPROVED" };
    const r = resolveTax({
      countryCode: "NO",
      currencyCode: "NOK",
      taxCategory: "cold_food",
      customerType: "B2B",
      fulfillmentType: "delivery",
      taxableBaseMinor: TEN_THOUSAND,
      taxPointDate: "2026-07-16",
      rules: [approved],
    });
    expect(r.ok).toBe(true);
    if (r.ok === true) {
      expect(r.taxAmountMinor).toBe(FIFTEEN_HUNDRED);
      expect(r.rateBps).toBe(1500);
    }
  });
});

describe("Phase 15G 21-country packs and gates", () => {
  it("has tax packs for all 21 countries and 0 APPROVED", () => {
    assertAllTaxPacksPresent();
    expect(Object.keys(COUNTRY_TAX_PACKS)).toHaveLength(21);
    const counts = countTaxPacksByStatus();
    expect(counts.APPROVED).toBe(0);
    expect(counts.RESEARCHED).toBe(21);
  });

  it("US/CA subdivision coverage is blocked pending evidence", () => {
    expect(COUNTRY_TAX_PACKS.US.subdivisionCoverage?.supportedCount).toBe(0);
    expect(COUNTRY_TAX_PACKS.CA.subdivisionCoverage?.supportedCount).toBe(0);
  });

  it("keeps 5% commission on all commercial models", () => {
    for (const c of SUPPORTED_COUNTRY_CODES) {
      assertCommissionIsFivePercent(MARKET_COMMERCIAL_MODELS[c]);
    }
  });

  it("legal stubs exist for 24 locales and 0 LEGAL_APPROVED", () => {
    expect(MARKET_LOCALE_CODES).toHaveLength(24);
    const stubs = buildLegalPackStubs();
    const counts = countLegalApprovals(stubs);
    expect(counts.legalApproved).toBe(0);
    expect(counts.total).toBeGreaterThan(21 * 8);
  });

  it("forbids DRAFT→ACTIVE shortcut and global activation without 21/21", () => {
    expect(canTransitionBuildState("DRAFT", "ACTIVE")).toBe(false);
    expect(() => assertNoShortcutToActive("DRAFT", "ACTIVE")).toThrow(/SHORTCUT_FORBIDDEN/);
    expect(() => assertGlobalActivationReady({ NO: "READY_FOR_GLOBAL_CUTOVER" })).toThrow(
      /GLOBAL_ACTIVATION_BLOCKED/,
    );
  });
});
