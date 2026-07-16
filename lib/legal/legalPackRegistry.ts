/**
 * Legal pack registry scaffolding (Phase 15G).
 * Machine translation alone cannot yield LEGAL_APPROVED.
 */

import type { CountryCode, MarketLocaleCode } from "@/lib/markets/supportedMarkets";
import { MARKET_LOCALE_CODES, SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";

export type LegalPackType =
  | "provider_terms"
  | "company_terms"
  | "employee_terms"
  | "privacy_notice"
  | "dpa"
  | "cancellation_refund"
  | "allergen_responsibility"
  | "invoice_payment_terms";

export type LegalReviewStatus =
  | "DRAFT"
  | "MACHINE_TRANSLATED"
  | "NATIVE_REVIEWED"
  | "LEGAL_APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type LegalPackStub = {
  countryCode: CountryCode;
  locale: MarketLocaleCode;
  packType: LegalPackType;
  version: string;
  reviewStatus: LegalReviewStatus;
};

const PACK_TYPES: readonly LegalPackType[] = [
  "provider_terms",
  "company_terms",
  "employee_terms",
  "privacy_notice",
  "dpa",
  "cancellation_refund",
  "allergen_responsibility",
  "invoice_payment_terms",
] as const;

function localesForCountry(country: CountryCode): MarketLocaleCode[] {
  return MARKET_LOCALE_CODES.filter((l) => l.endsWith(`-${country}`) || (country === "GB" && l === "en-GB"));
}

/** Build required stub matrix: 21 countries × locales × core pack types. */
export function buildLegalPackStubs(): LegalPackStub[] {
  const stubs: LegalPackStub[] = [];
  for (const country of SUPPORTED_COUNTRY_CODES) {
    const locales = localesForCountry(country);
    for (const locale of locales) {
      for (const packType of PACK_TYPES) {
        stubs.push({
          countryCode: country,
          locale,
          packType,
          version: "0.1.0-draft",
          reviewStatus: country === "NO" && locale === "nb-NO" ? "NATIVE_REVIEWED" : "DRAFT",
        });
      }
    }
  }
  return stubs;
}

export function countLegalApprovals(stubs: LegalPackStub[]): {
  total: number;
  legalApproved: number;
  nativeReviewed: number;
} {
  return {
    total: stubs.length,
    legalApproved: stubs.filter((s) => s.reviewStatus === "LEGAL_APPROVED").length,
    nativeReviewed: stubs.filter((s) => s.reviewStatus === "NATIVE_REVIEWED" || s.reviewStatus === "LEGAL_APPROVED")
      .length,
  };
}
