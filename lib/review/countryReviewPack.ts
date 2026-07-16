/**
 * Phase 15G.3B — canonical CountryReviewPack contract.
 * Fields are never left as unclassified MISSING after build.
 * APPROVED is never set by this builder.
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
import { countUsFixtureCoverage, countCanadaFixtureCoverage } from "@/lib/tax/providers/testFixtureProvider";
import {
  classifyCriticalQuestionsForCountry,
  type CriticalQuestionRecord,
} from "@/lib/review/criticalQuestions";

/** Frozen technical global RC — approvals for cutover bind to this SHA. */
export const PHASE15G3B_RC_SHA = "b88aaf99780e0a5d71404e831fd87eb90031fb6e";
/** Staging migration head after 15G.3B review-operations migration. */
export const PHASE15G3B_MIG_HEAD = "20260901120000";

export type PackFieldStatus =
  | "MISSING"
  | "RESEARCHED"
  | "TECHNICALLY_VERIFIED"
  | "EXTERNAL_DECISION_REQUIRED"
  | "REVIEW_ASSIGNED"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "NOT_APPLICABLE";

export type PackField = {
  field_key: string;
  section:
    | "identity"
    | "release"
    | "technical"
    | "tax"
    | "marketplace"
    | "invoice"
    | "e_invoice"
    | "legal"
    | "privacy"
    | "localization"
    | "registrations"
    | "credentials"
    | "unresolved"
    | "reviewer"
    | "approvals"
    | "readiness";
  country_code: CountryCode;
  locale: string | null;
  jurisdiction: string | null;
  value: unknown;
  source_evidence_ref: string | null;
  status: PackFieldStatus;
  blocking_severity: "P0" | "P1" | "P2" | null;
  owner_role: string;
  reviewer_role: string | null;
  completion_criteria: string;
  updated_at: string;
};

export type CountryReviewPack = {
  identity: { countryCode: CountryCode; packVersion: string };
  release: { sha: string; migrationHead: string };
  fields: PackField[];
  criticalQuestions: CriticalQuestionRecord[];
  packChecksum: string;
  reviewReady: boolean;
  missingMandatoryCount: number;
  externalDecisionCount: number;
  unclassifiedCriticalCount: number;
  approvals: {
    tax: "NONE" | "APPROVED";
    legal: "NONE" | "APPROVED";
    invoice: "NONE" | "APPROVED";
    eInvoice: "NONE" | "APPROVED" | "NOT_APPLICABLE";
    privacy: "NONE" | "APPROVED";
    localization: "NONE" | "APPROVED";
  };
};

const NOW = () => new Date().toISOString();

function field(partial: Omit<PackField, "updated_at"> & { updated_at?: string }): PackField {
  return { updated_at: partial.updated_at ?? NOW(), ...partial };
}

function extDecision(
  base: Omit<PackField, "status" | "updated_at" | "blocking_severity"> & {
    blocking_severity?: "P0" | "P1" | "P2";
  },
): PackField {
  return field({
    ...base,
    status: "EXTERNAL_DECISION_REQUIRED",
    blocking_severity: base.blocking_severity ?? "P0",
  });
}

export function buildCountryReviewPack(countryCode: CountryCode): CountryReviewPack {
  const tax = COUNTRY_TAX_PACKS[countryCode];
  const invoice = COUNTRY_INVOICE_PACKS[countryCode];
  const eInv = E_INVOICE_CAPABILITIES[countryCode];
  const market = MARKETPLACE_LEGAL_MODELS[countryCode];
  const marketRow = SUPPORTED_MARKETS.find((m) => m.countryCode === countryCode)!;
  const locales = SUPPORTED_MARKET_LOCALES.filter((l) => l.countryCode === countryCode).map((l) => l.locale);
  const eNa = eInv.requirementStatus === "NOT_APPLICABLE";
  const us = countUsFixtureCoverage();
  const ca = countCanadaFixtureCoverage();
  const fields: PackField[] = [];

  // identity / release / technical
  fields.push(
    field({
      field_key: "identity.country_code",
      section: "identity",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: countryCode,
      source_evidence_ref: "lib/markets/supportedMarkets.ts",
      status: "TECHNICALLY_VERIFIED",
      blocking_severity: null,
      owner_role: "release_coordinator",
      reviewer_role: null,
      completion_criteria: "Country in SUPPORTED_COUNTRY_CODES",
    }),
    field({
      field_key: "release.sha",
      section: "release",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: PHASE15G3B_RC_SHA,
      source_evidence_ref: "TECHNICAL_GLOBAL_RC",
      status: "TECHNICALLY_VERIFIED",
      blocking_severity: null,
      owner_role: "release_coordinator",
      reviewer_role: null,
      completion_criteria: "Exact frozen RC SHA",
    }),
    field({
      field_key: "release.migration_head",
      section: "release",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: PHASE15G3B_MIG_HEAD,
      source_evidence_ref: "supabase_migrations.schema_migrations",
      status: "TECHNICALLY_VERIFIED",
      blocking_severity: null,
      owner_role: "release_coordinator",
      reviewer_role: null,
      completion_criteria: "Staging migration ledger head",
    }),
    field({
      field_key: "technical.market_config",
      section: "technical",
      country_code: countryCode,
      locale: marketRow.defaultLocale,
      jurisdiction: null,
      value: {
        currency: marketRow.currency,
        timezone: marketRow.defaultTimezone,
        taxStrategy: marketRow.taxStrategy,
      },
      source_evidence_ref: "markets registry",
      status: "TECHNICALLY_VERIFIED",
      blocking_severity: null,
      owner_role: "product_owner",
      reviewer_role: null,
      completion_criteria: "Active market row with currency/timezone/tax strategy",
    }),
    field({
      field_key: "technical.golden_path_evidence",
      section: "technical",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: "tests/integration/full-21-country-rc-proof.integration.test.ts",
      source_evidence_ref: "15G.2C isolated GP",
      status: "TECHNICALLY_VERIFIED",
      blocking_severity: null,
      owner_role: "release_coordinator",
      reviewer_role: null,
      completion_criteria: "Country covered by technical Golden Path suite",
    }),
  );

  if (countryCode === "US") {
    fields.push(
      field({
        field_key: "technical.us_resolver_paths",
        section: "technical",
        country_code: countryCode,
        locale: null,
        jurisdiction: "US-*",
        value: { technicallySupportedOrNa: us.technicallySupported + us.notApplicable, blocked: us.blocked },
        source_evidence_ref: "lib/tax/providers/testFixtureProvider.ts",
        status: "TECHNICALLY_VERIFIED",
        blocking_severity: null,
        owner_role: "tax_reviewer",
        reviewer_role: "tax_reviewer",
        completion_criteria: "51/51 resolver path classification present",
      }),
    );
  }
  if (countryCode === "CA") {
    fields.push(
      field({
        field_key: "technical.ca_resolver_paths",
        section: "technical",
        country_code: countryCode,
        locale: null,
        jurisdiction: "CA-*",
        value: { technicallySupported: ca.technicallySupported },
        source_evidence_ref: "lib/tax/providers/testFixtureProvider.ts",
        status: "TECHNICALLY_VERIFIED",
        blocking_severity: null,
        owner_role: "tax_reviewer",
        reviewer_role: "tax_reviewer",
        completion_criteria: "13/13 resolver path classification present",
      }),
    );
  }

  // tax
  const srcOk = tax.officialSources.every((s) => isOfficialSourceUrl(s.sourceUrl));
  fields.push(
    field({
      field_key: "tax.strategy",
      section: "tax",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: tax.taxStrategy,
      source_evidence_ref: tax.officialSources[0]?.sourceUrl ?? null,
      status: "RESEARCHED",
      blocking_severity: null,
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "Strategy documented from official sources",
    }),
    field({
      field_key: "tax.official_sources",
      section: "tax",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: tax.officialSources,
      source_evidence_ref: tax.officialSources.map((s) => s.sourceUrl).join(" | "),
      status: srcOk ? "RESEARCHED" : "EXTERNAL_DECISION_REQUIRED",
      blocking_severity: srcOk ? null : "P0",
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "Allowlisted official primary sources linked",
    }),
    field({
      field_key: "tax.rate_matrix",
      section: "tax",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: "See researchedCountryRules / country tax pack",
      source_evidence_ref: tax.officialSources[0]?.sourceUrl ?? null,
      status: "RESEARCHED",
      blocking_severity: null,
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "Effective-dated matrix RESEARCHED from authority",
    }),
    extDecision({
      field_key: "tax.human_approval",
      section: "tax",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: null,
      source_evidence_ref: null,
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "Signed TAX_APPROVAL for exact RC SHA",
    }),
    extDecision({
      field_key: "tax.food_catering_classification",
      section: "tax",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: null,
      source_evidence_ref: tax.officialSources[0]?.sourceUrl ?? null,
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "External tax opinion on food/catering classes",
    }),
  );

  // marketplace / legal / privacy
  fields.push(
    field({
      field_key: "marketplace.model_disclosed",
      section: "marketplace",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: market,
      source_evidence_ref: "lib/markets/marketplaceLegalModel.ts",
      status: "RESEARCHED",
      blocking_severity: null,
      owner_role: "legal_reviewer",
      reviewer_role: "legal_reviewer",
      completion_criteria: "Platform role model documented as DRAFT/RESEARCHED",
    }),
    extDecision({
      field_key: "marketplace.legal_approval",
      section: "marketplace",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: null,
      source_evidence_ref: null,
      owner_role: "legal_reviewer",
      reviewer_role: "legal_reviewer",
      completion_criteria: "Signed LEGAL_APPROVAL of marketplace model",
    }),
    extDecision({
      field_key: "legal.provider_terms",
      section: "legal",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: "DRAFT stub in legal_document_versions",
      source_evidence_ref: "legal_document_versions",
      owner_role: "legal_reviewer",
      reviewer_role: "legal_reviewer",
      completion_criteria: "Signed provider terms for country",
    }),
    extDecision({
      field_key: "legal.company_terms",
      section: "legal",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: "DRAFT stub",
      source_evidence_ref: "legal_document_versions",
      owner_role: "legal_reviewer",
      reviewer_role: "legal_reviewer",
      completion_criteria: "Signed company terms",
    }),
    extDecision({
      field_key: "legal.employee_terms",
      section: "legal",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: "DRAFT stub",
      source_evidence_ref: "legal_document_versions",
      owner_role: "legal_reviewer",
      reviewer_role: "legal_reviewer",
      completion_criteria: "Signed employee/end-user terms",
    }),
    extDecision({
      field_key: "privacy.notice_and_dpa",
      section: "privacy",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: "DRAFT privacy stubs",
      source_evidence_ref: "legal_document_versions",
      owner_role: "legal_reviewer",
      reviewer_role: "legal_reviewer",
      completion_criteria: "Signed PRIVACY_APPROVAL + DPA",
    }),
  );

  // invoice / e-invoice
  fields.push(
    field({
      field_key: "invoice.pack",
      section: "invoice",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: invoice,
      source_evidence_ref: invoice.officialSourceUrl,
      status: "RESEARCHED",
      blocking_severity: null,
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "Invoice requirements RESEARCHED from authority",
    }),
    field({
      field_key: "invoice.retention_years",
      section: "invoice",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: invoice.retentionYears,
      source_evidence_ref: invoice.officialSourceUrl,
      status: invoice.retentionYears != null ? "RESEARCHED" : "EXTERNAL_DECISION_REQUIRED",
      blocking_severity: invoice.retentionYears != null ? null : "P1",
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "Retention years from statute or EXTERNAL_DECISION_REQUIRED task",
    }),
    extDecision({
      field_key: "invoice.human_approval",
      section: "invoice",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: null,
      source_evidence_ref: invoice.officialSourceUrl,
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "Signed INVOICE_APPROVAL",
    }),
  );

  if (eNa) {
    fields.push(
      field({
        field_key: "e_invoice.mandate",
        section: "e_invoice",
        country_code: countryCode,
        locale: null,
        jurisdiction: null,
        value: "NOT_APPLICABLE",
        source_evidence_ref: "lib/invoice/eInvoiceRegistry.ts",
        status: "NOT_APPLICABLE",
        blocking_severity: null,
        owner_role: "tax_reviewer",
        reviewer_role: "tax_reviewer",
        completion_criteria: "US national e-invoice mandate N/A for product scope — documented",
      }),
    );
  } else {
    fields.push(
      field({
        field_key: "e_invoice.capability",
        section: "e_invoice",
        country_code: countryCode,
        locale: null,
        jurisdiction: null,
        value: eInv,
        source_evidence_ref: eInv.officialSourceUrl,
        status: "RESEARCHED",
        blocking_severity: null,
        owner_role: "tax_reviewer",
        reviewer_role: "tax_reviewer",
        completion_criteria: "Channels + requirement status RESEARCHED",
      }),
      extDecision({
        field_key: "e_invoice.human_approval",
        section: "e_invoice",
        country_code: countryCode,
        locale: null,
        jurisdiction: null,
        value: null,
        source_evidence_ref: eInv.officialSourceUrl,
        owner_role: "tax_reviewer",
        reviewer_role: "tax_reviewer",
        completion_criteria: "Signed E_INVOICE_APPROVAL or confirmed N/A",
      }),
      extDecision({
        field_key: "e_invoice.live_registration",
        section: "e_invoice",
        country_code: countryCode,
        locale: null,
        jurisdiction: null,
        value: null,
        source_evidence_ref: null,
        owner_role: "tax_reviewer",
        reviewer_role: "tax_reviewer",
        completion_criteria: "Live Peppol/CTC registration evidence (not mock)",
      }),
    );
  }

  // localization
  for (const loc of locales) {
    fields.push(
      field({
        field_key: `localization.catalog.${loc}`,
        section: "localization",
        country_code: countryCode,
        locale: loc,
        jurisdiction: null,
        value: "Machine catalog present — native approval required",
        source_evidence_ref: "lib/i18n",
        status: "TECHNICALLY_VERIFIED",
        blocking_severity: null,
        owner_role: "native_language_reviewer",
        reviewer_role: "native_language_reviewer",
        completion_criteria: "Locale runtime-certified technically",
      }),
      extDecision({
        field_key: `localization.native_approval.${loc}`,
        section: "localization",
        country_code: countryCode,
        locale: loc,
        jurisdiction: null,
        value: null,
        source_evidence_ref: null,
        owner_role: "native_language_reviewer",
        reviewer_role: "native_language_reviewer",
        completion_criteria: `Signed NATIVE_LOCALIZATION_APPROVAL for ${loc}`,
      }),
    );
  }

  // registrations / credentials
  fields.push(
    extDecision({
      field_key: "registrations.tax_registration",
      section: "registrations",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: null,
      source_evidence_ref: null,
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "Verified VAT/GST/sales-tax registration metadata (no secret values)",
    }),
    extDecision({
      field_key: "registrations.legal_entity",
      section: "registrations",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: null,
      source_evidence_ref: null,
      owner_role: "legal_reviewer",
      reviewer_role: "legal_reviewer",
      completion_criteria: "Legal entity or approved cross-border structure evidence",
    }),
    field({
      field_key: "credentials.checklist",
      section: "credentials",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: credentialDependencies().filter((d) => d.countryCode === countryCode),
      source_evidence_ref: "lib/invoice/eInvoiceAdapters.ts",
      status: "TECHNICALLY_VERIFIED",
      blocking_severity: null,
      owner_role: "tax_reviewer",
      reviewer_role: "tax_reviewer",
      completion_criteria: "Operational checklist rows exist for country",
    }),
  );

  // reviewer / approvals / readiness
  fields.push(
    field({
      field_key: "reviewer.slots",
      section: "reviewer",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: { tax: "REVIEWER_REQUIRED", legal: "REVIEWER_REQUIRED", native: "REVIEWER_REQUIRED" },
      source_evidence_ref: "lib/review/reviewerRosterSlots.ts",
      status: "EXTERNAL_DECISION_REQUIRED",
      blocking_severity: "P0",
      owner_role: "release_coordinator",
      reviewer_role: null,
      completion_criteria: "Onboard real reviewers — do not fabricate",
    }),
    field({
      field_key: "approvals.lanes",
      section: "approvals",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: {
        tax: "NONE",
        legal: "NONE",
        invoice: "NONE",
        eInvoice: eNa ? "NOT_APPLICABLE" : "NONE",
        privacy: "NONE",
        localization: "NONE",
      },
      source_evidence_ref: "compliance_approvals",
      status: "EXTERNAL_DECISION_REQUIRED",
      blocking_severity: "P0",
      owner_role: "release_coordinator",
      reviewer_role: null,
      completion_criteria: "Real append-only approvals for exact RC",
    }),
    field({
      field_key: "readiness.global_cutover",
      section: "readiness",
      country_code: countryCode,
      locale: null,
      jurisdiction: null,
      value: "NOT_READY",
      source_evidence_ref: "lib/markets/globalActivationGate.ts",
      status: "EXTERNAL_DECISION_REQUIRED",
      blocking_severity: "P0",
      owner_role: "product_owner",
      reviewer_role: "product_owner",
      completion_criteria: "All lane approvals + credentials verified",
    }),
  );

  const criticalQuestions = classifyCriticalQuestionsForCountry(countryCode);
  for (const q of criticalQuestions) {
    fields.push(
      field({
        field_key: `unresolved.${q.questionId}`,
        section: "unresolved",
        country_code: countryCode,
        locale: q.locale,
        jurisdiction: q.jurisdiction,
        value: q,
        source_evidence_ref: q.officialSources.join(" | ") || null,
        status: q.status === "CLOSED_FACTUAL" ? "RESEARCHED" : "EXTERNAL_DECISION_REQUIRED",
        blocking_severity: q.status === "CLOSED_FACTUAL" ? null : "P0",
        owner_role: q.requiredReviewerRole,
        reviewer_role: q.requiredReviewerRole,
        completion_criteria: q.completionArtifact,
      }),
    );
  }

  const missingMandatoryCount = fields.filter((f) => f.status === "MISSING").length;
  const unclassifiedCriticalCount = criticalQuestions.filter((q) => q.status === "UNCLASSIFIED").length;
  const externalDecisionCount = fields.filter((f) => f.status === "EXTERNAL_DECISION_REQUIRED").length;
  const reviewReady = missingMandatoryCount === 0 && unclassifiedCriticalCount === 0;

  const packChecksum = createHash("sha256")
    .update(
      JSON.stringify({
        countryCode,
        sha: PHASE15G3B_RC_SHA,
        fieldKeys: fields.map((f) => f.field_key),
        statuses: fields.map((f) => f.status),
        questions: criticalQuestions.map((q) => q.questionId),
      }),
      "utf8",
    )
    .digest("hex");

  return {
    identity: { countryCode, packVersion: "15G.3B" },
    release: { sha: PHASE15G3B_RC_SHA, migrationHead: PHASE15G3B_MIG_HEAD },
    fields,
    criticalQuestions,
    packChecksum,
    reviewReady,
    missingMandatoryCount,
    externalDecisionCount,
    unclassifiedCriticalCount,
    approvals: {
      tax: "NONE",
      legal: "NONE",
      invoice: "NONE",
      eInvoice: eNa ? "NOT_APPLICABLE" : "NONE",
      privacy: "NONE",
      localization: "NONE",
    },
  };
}

export function auditAllCountryReviewPacks() {
  const packs = SUPPORTED_COUNTRY_CODES.map(buildCountryReviewPack);
  return {
    releaseSha: PHASE15G3B_RC_SHA,
    migrationHead: PHASE15G3B_MIG_HEAD,
    generatedAt: NOW(),
    packs,
    summary: {
      reviewReady: packs.filter((p) => p.reviewReady).length,
      incomplete: packs.filter((p) => !p.reviewReady).length,
      missingMandatoryFields: packs.reduce((n, p) => n + p.missingMandatoryCount, 0),
      externalDecisionsRequired: packs.reduce((n, p) => n + p.externalDecisionCount, 0),
      unclassifiedCriticalQuestions: packs.reduce((n, p) => n + p.unclassifiedCriticalCount, 0),
      criticalQuestionsTotal: packs.reduce((n, p) => n + p.criticalQuestions.length, 0),
      criticalClosedFactual: packs.reduce(
        (n, p) => n + p.criticalQuestions.filter((q) => q.status === "CLOSED_FACTUAL").length,
        0,
      ),
      criticalExternalDecision: packs.reduce(
        (n, p) => n + p.criticalQuestions.filter((q) => q.status === "EXTERNAL_DECISION_REQUIRED").length,
        0,
      ),
    },
  };
}
