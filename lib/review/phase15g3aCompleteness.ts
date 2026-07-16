/**
 * Phase 15G.3A — machine-readable country pack completeness audit.
 * Never marks APPROVED. Surfaces exact gaps for external reviewers.
 */

import { createHash } from "node:crypto";
import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES, SUPPORTED_MARKETS } from "@/lib/markets/supportedMarkets";
import { COUNTRY_TAX_PACKS } from "@/lib/tax/packs/countryTaxPacks";
import { COUNTRY_INVOICE_PACKS } from "@/lib/invoice/countryInvoicePacks";
import { E_INVOICE_CAPABILITIES } from "@/lib/invoice/eInvoiceRegistry";
import { MARKETPLACE_LEGAL_MODELS } from "@/lib/markets/marketplaceLegalModel";
import { credentialDependencies } from "@/lib/invoice/eInvoiceAdapters";
import { isOfficialSourceUrl } from "@/lib/tax/sources/allowedOfficialDomains";
import { SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";
import { countReviewerRoster } from "@/lib/review/reviewerRosterSlots";

export type GapSeverity = "P0" | "P1" | "P2";

export type CompletenessGap = {
  field: string;
  section: "tax" | "marketplace" | "invoice" | "legal_privacy" | "localization" | "technical" | "credentials" | "reviewer";
  severity: GapSeverity;
  ownerRole: string;
  officialSourceNeeded: string | null;
  reviewerType: string | null;
  blockingCredential: string | null;
  completionEvidence: string;
};

export type CountryCompletenessReport = {
  countryCode: CountryCode;
  releaseSha: string;
  migrationHead: string;
  packComplete: boolean;
  missingMandatoryFields: CompletenessGap[];
  unresolvedCriticalQuestions: string[];
  officialSourcesPresent: number;
  officialSourcesMissingOrUnsupported: number;
  reviewerStatus: "REVIEWER_REQUIRED";
  approvals: {
    tax: "NONE";
    legal: "NONE";
    invoice: "NONE";
    eInvoice: "NONE" | "NOT_APPLICABLE";
    privacy: "NONE";
    localization: "NONE";
  };
  credentials: Array<{
    dependency: string;
    status: "BLOCKED" | "NOT_APPLICABLE" | "VERIFIED";
  }>;
  locales: string[];
  evidenceChecksum: string;
};

const RC_SHA = "b88aaf99780e0a5d71404e831fd87eb90031fb6e";
const MIG_HEAD = "20260831120000";

function gap(
  partial: Omit<CompletenessGap, "completionEvidence"> & { completionEvidence?: string },
): CompletenessGap {
  return {
    completionEvidence:
      partial.completionEvidence ??
      "Signed external approval + evidence checksum linked to exact RC SHA",
    ...partial,
  };
}

export function auditCountryCompleteness(countryCode: CountryCode): CountryCompletenessReport {
  const tax = COUNTRY_TAX_PACKS[countryCode];
  const invoice = COUNTRY_INVOICE_PACKS[countryCode];
  const eInv = E_INVOICE_CAPABILITIES[countryCode];
  const market = MARKETPLACE_LEGAL_MODELS[countryCode];
  const marketRow = SUPPORTED_MARKETS.find((m) => m.countryCode === countryCode)!;
  const locales = SUPPORTED_MARKET_LOCALES.filter((l) => l.countryCode === countryCode).map((l) => l.locale);

  const missing: CompletenessGap[] = [];
  const critical: string[] = [...tax.openQuestions];

  // Tax
  if (tax.reviewStatus !== "APPROVED") {
    missing.push(
      gap({
        field: "tax.human_approval",
        section: "tax",
        severity: "P0",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: tax.officialSources.map((s) => s.sourceUrl).join(" | ") || null,
        reviewerType: "tax_reviewer",
        blockingCredential: null,
      }),
    );
  }
  if (!tax.officialSources.length) {
    missing.push(
      gap({
        field: "tax.official_sources",
        section: "tax",
        severity: "P0",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: "National tax authority primary URL",
        reviewerType: "tax_reviewer",
        blockingCredential: null,
      }),
    );
  }
  missing.push(
    gap({
      field: "tax.effective_dated_rate_matrix_signed",
      section: "tax",
      severity: "P0",
      ownerRole: "tax_reviewer",
      officialSourceNeeded: "Authority rate table with effective dates",
      reviewerType: "tax_reviewer",
      blockingCredential: null,
      completionEvidence: "Tax reviewer APPROVE on compliance_review_queue subject tax-matrix",
    }),
  );
  missing.push(
    gap({
      field: "tax.food_catering_classification_signed",
      section: "tax",
      severity: "P0",
      ownerRole: "tax_reviewer",
      officialSourceNeeded: "National food/catering VAT/sales-tax classification",
      reviewerType: "tax_reviewer",
      blockingCredential: null,
    }),
  );

  if (countryCode === "US") {
    critical.push("US launch-footprint state/local taxability + nexus/marketplace facilitator assessment unsigned");
    missing.push(
      gap({
        field: "tax.us_subdivision_launch_approval",
        section: "tax",
        severity: "P0",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: "State DOR / marketplace facilitator primary sources",
        reviewerType: "tax_reviewer",
        blockingCredential: "US:sales_tax:registration_footprint",
      }),
    );
  }
  if (countryCode === "CA") {
    critical.push("Canada GST/HST/PST/QST component model unsigned for launch provinces");
    missing.push(
      gap({
        field: "tax.ca_component_approval",
        section: "tax",
        severity: "P0",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: "CRA + provincial finance ministries",
        reviewerType: "tax_reviewer",
        blockingCredential: "CA:gst_hst:registration",
      }),
    );
  }

  // Marketplace / legal
  if (market.status !== "APPROVED") {
    missing.push(
      gap({
        field: "marketplace.legal_model_approval",
        section: "marketplace",
        severity: "P0",
        ownerRole: "legal_reviewer",
        officialSourceNeeded: null,
        reviewerType: "legal_reviewer",
        blockingCredential: null,
      }),
    );
  }
  for (const f of [
    "provider_terms_signed",
    "company_terms_signed",
    "employee_terms_signed",
    "cancellation_refund_signed",
    "allergen_responsibility_signed",
    "applicable_law_jurisdiction_signed",
  ]) {
    missing.push(
      gap({
        field: `legal.${f}`,
        section: "legal_privacy",
        severity: "P0",
        ownerRole: "legal_reviewer",
        officialSourceNeeded: null,
        reviewerType: "legal_reviewer",
        blockingCredential: null,
      }),
    );
  }
  for (const f of [
    "privacy_notice_signed",
    "dpa_signed",
    "controller_processor_mapping_signed",
    "international_transfer_basis_signed",
  ]) {
    missing.push(
      gap({
        field: `privacy.${f}`,
        section: "legal_privacy",
        severity: "P0",
        ownerRole: "legal_reviewer",
        officialSourceNeeded: null,
        reviewerType: "legal_reviewer",
        blockingCredential: null,
      }),
    );
  }

  // Invoice / e-invoice
  if (invoice.reviewStatus !== "APPROVED") {
    missing.push(
      gap({
        field: "invoice.pack_approval",
        section: "invoice",
        severity: "P0",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: invoice.officialSourceUrl,
        reviewerType: "tax_reviewer",
        blockingCredential: null,
      }),
    );
  }
  if (invoice.retentionYears == null) {
    missing.push(
      gap({
        field: "invoice.retention_years",
        section: "invoice",
        severity: "P1",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: "National retention statute",
        reviewerType: "tax_reviewer",
        blockingCredential: null,
      }),
    );
  }

  const eInvoiceNa = eInv.requirementStatus === "NOT_APPLICABLE";
  if (!eInvoiceNa && eInv.reviewerApproval !== "APPROVED") {
    missing.push(
      gap({
        field: "e_invoice.reviewer_approval",
        section: "invoice",
        severity: "P0",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: eInv.officialSourceUrl,
        reviewerType: "tax_reviewer",
        blockingCredential: eInv.channels.includes("peppol")
          ? `${countryCode}:peppol:access_point_contract`
          : eInv.channels.includes("national_ctc")
            ? `${countryCode}:national_ctc:sandbox_credentials`
            : null,
      }),
    );
  }
  if (!eInvoiceNa && !eInv.effectiveDate) {
    missing.push(
      gap({
        field: "e_invoice.mandate_effective_date",
        section: "invoice",
        severity: "P1",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: eInv.officialSourceUrl,
        reviewerType: "tax_reviewer",
        blockingCredential: null,
      }),
    );
  }
  if (!eInvoiceNa && eInv.stagingDeliveryProof == null) {
    missing.push(
      gap({
        field: "e_invoice.live_registration_proof",
        section: "invoice",
        severity: "P0",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: null,
        reviewerType: "tax_reviewer",
        blockingCredential: `${countryCode}:e_invoice:live_registration`,
        completionEvidence: "Live Peppol/CTC registration ID — mock DELIVERED_MOCK is insufficient",
      }),
    );
  }

  // Localization
  for (const loc of locales) {
    missing.push(
      gap({
        field: `localization.native_approval.${loc}`,
        section: "localization",
        severity: "P0",
        ownerRole: "native_language_reviewer",
        officialSourceNeeded: null,
        reviewerType: "native_language_reviewer",
        blockingCredential: null,
        completionEvidence: `Native reviewer APPROVE for locale ${loc}`,
      }),
    );
  }

  // Technical pointers (present from 15G.2C — still list release identity for pack)
  // Reviewer
  missing.push(
    gap({
      field: "reviewer.assigned_tax",
      section: "reviewer",
      severity: "P0",
      ownerRole: "release_coordinator",
      officialSourceNeeded: null,
      reviewerType: "tax_reviewer",
      blockingCredential: null,
      completionEvidence: "Onboard named tax reviewer with credential + COI declaration",
    }),
  );
  missing.push(
    gap({
      field: "reviewer.assigned_legal",
      section: "reviewer",
      severity: "P0",
      ownerRole: "release_coordinator",
      officialSourceNeeded: null,
      reviewerType: "legal_reviewer",
      blockingCredential: null,
      completionEvidence: "Onboard named legal reviewer with credential + COI declaration",
    }),
  );

  // Credentials
  const creds: Array<{ dependency: string; status: "BLOCKED" | "NOT_APPLICABLE" | "VERIFIED" }> =
    credentialDependencies()
      .filter((c) => c.countryCode === countryCode)
      .map((c) => ({ dependency: c.dependency, status: "BLOCKED" as const }));
  if (eInvoiceNa) {
    creds.push({ dependency: `${countryCode}:e_invoice:national_mandate`, status: "NOT_APPLICABLE" });
  }
  for (const c of creds.filter((x) => x.status === "BLOCKED")) {
    missing.push(
      gap({
        field: `credentials.${c.dependency}`,
        section: "credentials",
        severity: "P0",
        ownerRole: "tax_reviewer",
        officialSourceNeeded: null,
        reviewerType: "tax_reviewer",
        blockingCredential: c.dependency,
        completionEvidence: "VERIFIED live registration/credential — not sandbox mock",
      }),
    );
  }
  missing.push(
    gap({
      field: "credentials.tax_registration",
      section: "credentials",
      severity: "P0",
      ownerRole: "tax_reviewer",
      officialSourceNeeded: null,
      reviewerType: "tax_reviewer",
      blockingCredential: `${countryCode}:tax:registration`,
      completionEvidence: "VAT/GST/sales-tax number VERIFIED for launch entity",
    }),
  );

  let unsupported = 0;
  for (const s of tax.officialSources) {
    if (!isOfficialSourceUrl(s.sourceUrl)) unsupported++;
  }

  const body = JSON.stringify({
    countryCode,
    missing: missing.map((m) => m.field),
    critical,
    releaseSha: RC_SHA,
  });
  const evidenceChecksum = createHash("sha256").update(body, "utf8").digest("hex");

  return {
    countryCode,
    releaseSha: RC_SHA,
    migrationHead: MIG_HEAD,
    packComplete: false,
    missingMandatoryFields: missing,
    unresolvedCriticalQuestions: critical,
    officialSourcesPresent: tax.officialSources.length - unsupported,
    officialSourcesMissingOrUnsupported: unsupported,
    reviewerStatus: "REVIEWER_REQUIRED",
    approvals: {
      tax: "NONE",
      legal: "NONE",
      invoice: "NONE",
      eInvoice: eInvoiceNa ? "NOT_APPLICABLE" : "NONE",
      privacy: "NONE",
      localization: "NONE",
    },
    credentials: [
      ...creds,
      { dependency: `${countryCode}:tax:registration`, status: "BLOCKED" },
      { dependency: `${countryCode}:legal_entity_or_cross_border`, status: "BLOCKED" },
      { dependency: `${countryCode}:invoice_issuer_readiness`, status: "BLOCKED" },
    ],
    locales,
    evidenceChecksum,
  };
}

export function auditAllCountries(): {
  releaseSha: string;
  migrationHead: string;
  generatedAt: string;
  countries: CountryCompletenessReport[];
  summary: {
    complete: number;
    incomplete: number;
    missingMandatoryFieldCount: number;
    unresolvedCriticalQuestionCount: number;
    unsupportedOfficialSources: number;
    reviewerRoster: ReturnType<typeof countReviewerRoster>;
    approvals: {
      TAX_APPROVED: number;
      LEGAL_APPROVED: number;
      INVOICE_APPROVED: number;
      E_INVOICE_APPROVED_OR_NOT_APPLICABLE: number;
      PRIVACY_APPROVED: number;
      LOCALIZATION_APPROVED: number;
      READY_FOR_GLOBAL_CUTOVER: number;
    };
  };
} {
  const countries = SUPPORTED_COUNTRY_CODES.map(auditCountryCompleteness);
  const eNa = countries.filter((c) => c.approvals.eInvoice === "NOT_APPLICABLE").length;
  return {
    releaseSha: RC_SHA,
    migrationHead: MIG_HEAD,
    generatedAt: new Date().toISOString(),
    countries,
    summary: {
      complete: countries.filter((c) => c.packComplete).length,
      incomplete: countries.filter((c) => !c.packComplete).length,
      missingMandatoryFieldCount: countries.reduce((n, c) => n + c.missingMandatoryFields.length, 0),
      unresolvedCriticalQuestionCount: countries.reduce((n, c) => n + c.unresolvedCriticalQuestions.length, 0),
      unsupportedOfficialSources: countries.reduce((n, c) => n + c.officialSourcesMissingOrUnsupported, 0),
      reviewerRoster: countReviewerRoster(),
      approvals: {
        TAX_APPROVED: 0,
        LEGAL_APPROVED: 0,
        INVOICE_APPROVED: 0,
        E_INVOICE_APPROVED_OR_NOT_APPLICABLE: eNa,
        PRIVACY_APPROVED: 0,
        LOCALIZATION_APPROVED: 0,
        READY_FOR_GLOBAL_CUTOVER: 0,
      },
    },
  };
}

export type ReviewQueueSeed = {
  domain: "tax" | "legal" | "invoice" | "e_invoice" | "privacy" | "localization" | "marketplace";
  countryCode: string;
  locale: string | null;
  subjectId: string;
  evidenceChecksum: string;
  status: "QUEUED";
  subjectAuthorId: string;
};

/** Build QUEUED review tasks — never APPROVED. */
export function buildPhase15g3aReviewQueues(): ReviewQueueSeed[] {
  const out: ReviewQueueSeed[] = [];
  const author = "system:phase15g3a-pack-builder";
  for (const cc of SUPPORTED_COUNTRY_CODES) {
    const report = auditCountryCompleteness(cc);
    const checksum = report.evidenceChecksum;
    out.push(
      {
        domain: "tax",
        countryCode: cc,
        locale: null,
        subjectId: `tax-pack:${cc}:${RC_SHA}`,
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: author,
      },
      {
        domain: "marketplace",
        countryCode: cc,
        locale: null,
        subjectId: `marketplace-model:${cc}:${RC_SHA}`,
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: author,
      },
      {
        domain: "invoice",
        countryCode: cc,
        locale: null,
        subjectId: `invoice-pack:${cc}:${RC_SHA}`,
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: author,
      },
      {
        domain: "privacy",
        countryCode: cc,
        locale: null,
        subjectId: `privacy-pack:${cc}:${RC_SHA}`,
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: author,
      },
      {
        domain: "legal",
        countryCode: cc,
        locale: null,
        subjectId: `legal-pack:${cc}:${RC_SHA}`,
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: author,
      },
    );
    if (report.approvals.eInvoice !== "NOT_APPLICABLE") {
      out.push({
        domain: "e_invoice",
        countryCode: cc,
        locale: null,
        subjectId: `e-invoice:${cc}:${RC_SHA}`,
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: author,
      });
    }
    for (const loc of report.locales) {
      out.push({
        domain: "localization",
        countryCode: cc,
        locale: loc,
        subjectId: `locale:${loc}:${RC_SHA}`,
        evidenceChecksum: checksum,
        status: "QUEUED",
        subjectAuthorId: author,
      });
    }
  }
  return out;
}
