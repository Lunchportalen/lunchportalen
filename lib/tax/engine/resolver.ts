/**
 * Fail-closed global tax resolver (Phase 15G).
 *
 * Rules:
 * - Never invent a rate.
 * - Only APPROVED + effective-dated rules may produce a taxable result.
 * - Missing rule → TAX_RULE_MISSING (fail closed).
 * - Currency must be explicit; never inferred from language.
 */

import { taxOnExclusiveBase } from "@/lib/money/minorUnits";
import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";

export const TAX_ENGINE_VERSION = "15g.1.0";

export type TaxCustomerType = "B2B" | "B2C";
export type TaxFulfillmentType = "delivery" | "takeaway" | "on_premise" | "catering";

export type TaxCategoryCode =
  | "cold_food"
  | "hot_food"
  | "prepared_food"
  | "restaurant_service"
  | "catering_service"
  | "staffed_catering"
  | "takeaway"
  | "delivery_fee"
  | "service_fee"
  | "platform_commission"
  | "alcohol"
  | "non_alcoholic_beverage"
  | "gratuity"
  | "packaging"
  | "refundable_deposit"
  | "discount"
  | "credit_adjustment";

export type TaxRuleRecord = {
  id: string;
  countryCode: CountryCode;
  jurisdictionPath: string;
  taxCategory: TaxCategoryCode;
  customerType: "any" | TaxCustomerType;
  fulfillmentType: "any" | TaxFulfillmentType;
  rateBps: number;
  inclusive: boolean;
  reverseCharge: boolean;
  exemptionCode: string | null;
  taxCode: string | null;
  invoiceWordingKey: string | null;
  evidenceId: string | null;
  validFrom: string; // YYYY-MM-DD
  validTo: string | null;
  reviewStatus: "RESEARCHED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXPIRED";
};

export type TaxResolveInput = {
  countryCode: string;
  currencyCode: string;
  taxCategory: TaxCategoryCode;
  customerType: TaxCustomerType;
  fulfillmentType: TaxFulfillmentType;
  taxableBaseMinor: bigint;
  taxPointDate: string; // YYYY-MM-DD
  /** Optional: US state / CA province code when country requires subdivision. */
  subdivisionCode?: string | null;
  rules: readonly TaxRuleRecord[];
};

export type TaxResolveSuccess = {
  ok: true;
  engineVersion: typeof TAX_ENGINE_VERSION;
  countryCode: CountryCode;
  currencyCode: string;
  jurisdictionPath: string;
  rateBps: number;
  inclusive: boolean;
  reverseCharge: boolean;
  taxableBaseMinor: bigint;
  taxAmountMinor: bigint;
  ruleId: string;
  evidenceId: string | null;
  taxCode: string | null;
  invoiceWordingKey: string | null;
};

export type TaxResolveFailure = {
  ok: false;
  code:
    | "COUNTRY_UNSUPPORTED"
    | "TAX_RULE_MISSING"
    | "TAX_RULE_NOT_APPROVED"
    | "TAX_RULE_NOT_EFFECTIVE"
    | "SUBDIVISION_REQUIRED"
    | "SUBDIVISION_UNSUPPORTED"
    | "CURRENCY_MISSING";
  message: string;
};

export type TaxResolveResult = TaxResolveSuccess | TaxResolveFailure;

function isCountry(code: string): code is CountryCode {
  return (SUPPORTED_COUNTRY_CODES as readonly string[]).includes(code);
}

function dateInRange(day: string, from: string, to: string | null): boolean {
  if (day < from) return false;
  if (to && day >= to) return false;
  return true;
}

function matchesDimension<T extends string>(ruleValue: "any" | T, input: T): boolean {
  return ruleValue === "any" || ruleValue === input;
}

/**
 * Resolve tax for a single commercial line. Fail-closed.
 */
export function resolveTax(input: TaxResolveInput): TaxResolveResult {
  const country = input.countryCode.trim().toUpperCase();
  if (!isCountry(country)) {
    return { ok: false, code: "COUNTRY_UNSUPPORTED", message: `Unsupported country ${country}` };
  }
  const currency = input.currencyCode.trim().toUpperCase();
  if (!currency) {
    return { ok: false, code: "CURRENCY_MISSING", message: "currencyCode required" };
  }

  // US/CA require subdivision for launch coverage — fail closed until SUPPORTED.
  if ((country === "US" || country === "CA") && !input.subdivisionCode) {
    return {
      ok: false,
      code: "SUBDIVISION_REQUIRED",
      message: `${country} requires state/province jurisdiction; not provided`,
    };
  }

  const candidates = input.rules.filter((r) => {
    if (r.countryCode !== country) return false;
    if (r.taxCategory !== input.taxCategory) return false;
    if (!matchesDimension(r.customerType, input.customerType)) return false;
    if (!matchesDimension(r.fulfillmentType, input.fulfillmentType)) return false;
    return true;
  });

  if (candidates.length === 0) {
    return {
      ok: false,
      code: "TAX_RULE_MISSING",
      message: `No tax rule for ${country}/${input.taxCategory}`,
    };
  }

  const approvedEffective = candidates.filter(
    (r) => r.reviewStatus === "APPROVED" && dateInRange(input.taxPointDate, r.validFrom, r.validTo),
  );

  if (approvedEffective.length === 0) {
    const anyApproved = candidates.some((r) => r.reviewStatus === "APPROVED");
    if (!anyApproved) {
      return {
        ok: false,
        code: "TAX_RULE_NOT_APPROVED",
        message: `Tax rules exist for ${country}/${input.taxCategory} but none are APPROVED (human tax review required)`,
      };
    }
    return {
      ok: false,
      code: "TAX_RULE_NOT_EFFECTIVE",
      message: `No APPROVED tax rule effective on ${input.taxPointDate}`,
    };
  }

  // Deterministic: prefer most specific jurisdiction path, then latest validFrom.
  const rule = [...approvedEffective].sort((a, b) => {
    const pathDiff = b.jurisdictionPath.length - a.jurisdictionPath.length;
    if (pathDiff !== 0) return pathDiff;
    return b.validFrom.localeCompare(a.validFrom);
  })[0]!;

  if (country === "US" || country === "CA") {
    const sub = String(input.subdivisionCode ?? "").toUpperCase();
    if (!rule.jurisdictionPath.includes(`/${sub}`) && rule.jurisdictionPath !== country) {
      // Country-level APPROVED rule alone is insufficient for US/CA launch.
      return {
        ok: false,
        code: "SUBDIVISION_UNSUPPORTED",
        message: `No APPROVED ${country} rule covering subdivision ${sub}`,
      };
    }
  }

  const taxAmount = rule.inclusive
    ? BigInt(0) // inclusive extraction deferred — refuse silent gross-split below
    : taxOnExclusiveBase(input.taxableBaseMinor, rule.rateBps);

  if (rule.inclusive) {
    // Inclusive tax split must be explicit; refuse silent inference.
    return {
      ok: false,
      code: "TAX_RULE_MISSING",
      message: "Inclusive tax resolution not enabled without explicit gross-split rule",
    };
  }

  return {
    ok: true,
    engineVersion: TAX_ENGINE_VERSION,
    countryCode: country,
    currencyCode: currency,
    jurisdictionPath: rule.jurisdictionPath,
    rateBps: rule.rateBps,
    inclusive: rule.inclusive,
    reverseCharge: rule.reverseCharge,
    taxableBaseMinor: input.taxableBaseMinor,
    taxAmountMinor: taxAmount,
    ruleId: rule.id,
    evidenceId: rule.evidenceId,
    taxCode: rule.taxCode,
    invoiceWordingKey: rule.invoiceWordingKey,
  };
}
