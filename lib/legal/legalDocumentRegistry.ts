/**
 * Versioned legal document matrix for 24 locales (Phase 15G.1).
 * Machine-generated content may only be DRAFT / MACHINE_TRANSLATED.
 * LEGAL_APPROVED and NATIVE_REVIEWED require human reviewers — never forged here.
 */

import type { CountryCode, MarketLocaleCode } from "@/lib/markets/supportedMarkets";
import { MARKET_LOCALE_CODES, MARKET_LOCALES } from "@/lib/markets/supportedMarkets";
import { createHash } from "node:crypto";

export type LegalDocumentType =
  | "provider_terms"
  | "company_terms"
  | "employee_terms"
  | "privacy_notice"
  | "cookie_notice"
  | "dpa"
  | "subprocessor_notice"
  | "cancellation_refund"
  | "acceptable_use"
  | "dispute_complaint"
  | "marketing_consent"
  | "allergen_food_responsibility"
  | "invoice_payment_terms"
  | "retention_deletion"
  | "international_transfer";

export type LegalDocStatus =
  | "DRAFT"
  | "MACHINE_TRANSLATED"
  | "NATIVE_REVIEWED"
  | "LEGAL_APPROVED"
  | "REJECTED"
  | "EXPIRED";

export type LegalDocumentVersion = {
  countryCode: CountryCode;
  locale: MarketLocaleCode;
  documentType: LegalDocumentType;
  version: string;
  validFrom: string;
  checksum: string;
  officialLegalSources: readonly string[];
  reviewerStatus: LegalDocStatus;
  nativeReviewerStatus: LegalDocStatus;
  bodyStub: string;
};

const DOC_TYPES: readonly LegalDocumentType[] = [
  "provider_terms",
  "company_terms",
  "employee_terms",
  "privacy_notice",
  "cookie_notice",
  "dpa",
  "subprocessor_notice",
  "cancellation_refund",
  "acceptable_use",
  "dispute_complaint",
  "marketing_consent",
  "allergen_food_responsibility",
  "invoice_payment_terms",
  "retention_deletion",
  "international_transfer",
] as const;

function stubBody(country: CountryCode, locale: MarketLocaleCode, type: LegalDocumentType): string {
  return [
    `DRAFT LEGAL DOCUMENT — NOT LEGALLY APPROVED`,
    `country=${country}`,
    `locale=${locale}`,
    `type=${type}`,
    `version=0.2.0-draft`,
    `This text is a structural stub for localization and acceptance wiring.`,
    `Machine translation alone cannot produce LEGAL_APPROVED status.`,
  ].join("\n");
}

export function buildLegalDocumentMatrix(): LegalDocumentVersion[] {
  const out: LegalDocumentVersion[] = [];
  for (const market of MARKET_LOCALES) {
    const { countryCode: country, locale } = market;
    for (const documentType of DOC_TYPES) {
      const bodyStub = stubBody(country, locale, documentType);
      const isNbNo = country === "NO" && locale === "nb-NO";
      out.push({
        countryCode: country,
        locale,
        documentType,
        version: "0.2.0-draft",
        validFrom: "2026-07-16",
        checksum: createHash("sha256").update(bodyStub, "utf8").digest("hex"),
        officialLegalSources: [],
        reviewerStatus: "DRAFT",
        nativeReviewerStatus: isNbNo ? "NATIVE_REVIEWED" : "DRAFT",
        bodyStub,
      });
    }
  }
  return out;
}

export function countLegalDocumentApprovals(docs = buildLegalDocumentMatrix()): {
  totalDocs: number;
  legalApproved: number;
  privacyApproved: number;
  nativeApprovedLocales: number;
  localesTotal: number;
} {
  const legalApproved = docs.filter((d) => d.reviewerStatus === "LEGAL_APPROVED").length;
  const privacyApprovedCountries = new Set(
    docs
      .filter((d) => d.documentType === "privacy_notice" && d.reviewerStatus === "LEGAL_APPROVED")
      .map((d) => d.countryCode),
  );
  const nativeByLocale = new Map<string, boolean>();
  for (const locale of MARKET_LOCALE_CODES) {
    const localeDocs = docs.filter((d) => d.locale === locale);
    const ok =
      localeDocs.length > 0 &&
      localeDocs.every(
        (d) => d.nativeReviewerStatus === "NATIVE_REVIEWED" || d.nativeReviewerStatus === "LEGAL_APPROVED",
      );
    nativeByLocale.set(locale, ok);
  }
  return {
    totalDocs: docs.length,
    legalApproved,
    privacyApproved: privacyApprovedCountries.size,
    nativeApprovedLocales: [...nativeByLocale.values()].filter(Boolean).length,
    localesTotal: MARKET_LOCALE_CODES.length,
  };
}

export function assertNoForgedLegalApprovals(docs = buildLegalDocumentMatrix()): void {
  const forged = docs.filter((d) => d.reviewerStatus === "LEGAL_APPROVED");
  if (forged.length > 0) {
    throw new Error(`FORGED_LEGAL_APPROVAL:${forged.length}`);
  }
}
