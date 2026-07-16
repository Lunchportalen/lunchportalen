/**
 * Phase 15G.3B — reviewer procurement / scope matrix.
 * Never invents reviewer names or organizations.
 */

import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";

export type ScopeNeed = {
  scopeId: string;
  role: string;
  countries: string[];
  locales: string[] | null;
  approvalTypes: string[];
  filled: false;
  groupingHint: string;
};

export function buildReviewerStaffingPlan() {
  const taxScopes: ScopeNeed[] = SUPPORTED_COUNTRY_CODES.map((cc) => ({
    scopeId: `tax-${cc}`,
    role: "tax_reviewer",
    countries: [cc],
    locales: null,
    approvalTypes: ["TAX_APPROVAL", "INVOICE_APPROVAL", "E_INVOICE_APPROVAL", "REGISTRATION_CREDENTIAL_APPROVAL"],
    filled: false as const,
    groupingHint:
      cc === "US" || cc === "CA"
        ? "Dedicated NA tax counsel recommended (subdivision complexity)"
        : "May group Nordics/DACH/Benelux if firm credential covers each country explicitly",
  }));

  const legalScopes: ScopeNeed[] = SUPPORTED_COUNTRY_CODES.map((cc) => ({
    scopeId: `legal-${cc}`,
    role: "legal_reviewer",
    countries: [cc],
    locales: null,
    approvalTypes: ["LEGAL_APPROVAL", "PRIVACY_APPROVAL"],
    filled: false as const,
    groupingHint: "Privacy + marketplace legal often same firm if COI clear and country scope explicit",
  }));

  const invoiceScopes: ScopeNeed[] = SUPPORTED_COUNTRY_CODES.map((cc) => ({
    scopeId: `invoice-${cc}`,
    role: "tax_reviewer|legal_reviewer",
    countries: [cc],
    locales: null,
    approvalTypes: ["INVOICE_APPROVAL", "E_INVOICE_APPROVAL"],
    filled: false as const,
    groupingHint: "Usually covered by tax scope; Peppol/CTC countries need e-invoice specialist",
  }));

  const privacyScopes: ScopeNeed[] = SUPPORTED_COUNTRY_CODES.map((cc) => ({
    scopeId: `privacy-${cc}`,
    role: "legal_reviewer|security_reviewer",
    countries: [cc],
    locales: null,
    approvalTypes: ["PRIVACY_APPROVAL"],
    filled: false as const,
    groupingHint: "EU/EEA may share GDPR counsel with per-country DPA addenda",
  }));

  const nativeScopes: ScopeNeed[] = SUPPORTED_MARKET_LOCALES.map((m) => ({
    scopeId: `native-${m.locale}`,
    role: "native_language_reviewer",
    countries: [m.countryCode],
    locales: [m.locale],
    approvalTypes: ["NATIVE_LOCALIZATION_APPROVAL"],
    filled: false as const,
    groupingHint: "One native reviewer per locale; en-GB/en-US/en-CA/en-IE require separate locale sign-off",
  }));

  const globalScopes: ScopeNeed[] = [
    {
      scopeId: "security-global",
      role: "security_reviewer",
      countries: ["ALL"],
      locales: ["ALL"],
      approvalTypes: ["SECURITY_APPROVAL", "PRIVACY_APPROVAL"],
      filled: false,
      groupingHint: "Single global security reviewer permitted if ACTIVE + COI clear",
    },
    {
      scopeId: "product-owner-global",
      role: "product_owner",
      countries: ["ALL"],
      locales: null,
      approvalTypes: ["PRODUCT_OWNER_APPROVAL"],
      filled: false,
      groupingHint: "Product owner cannot self-approve tax/legal lanes",
    },
  ];

  const criticalPathCountries = ["NO", "DE", "FR", "IT", "US", "CA", "GB"] as const;
  const sequence = [
    "1) Onboard tax reviewers for critical-path countries",
    "2) Onboard legal/privacy reviewers (marketplace model blocks invoice wording)",
    "3) Invoice/e-invoice after tax model draft approval path exists",
    "4) Native localization in parallel once UI freeze SHA known (current RC)",
    "5) Registration/credential verification after tax/legal decisions",
    "6) Security + product owner final gates",
  ];

  const dependencies = [
    "TAX_APPROVAL before READY_FOR_GLOBAL_CUTOVER tax lane",
    "LEGAL_APPROVAL (marketplace) before invoice issuer assumptions",
    "E_INVOICE_APPROVAL or N/A before Peppol/CTC credential VERIFIED",
    "NATIVE_LOCALIZATION_APPROVAL per locale before country cutover",
    "REGISTRATION_CREDENTIAL_APPROVAL after live authority evidence upload",
  ];

  return {
    minimumCoverage: {
      tax: taxScopes.length,
      legal: legalScopes.length,
      invoice: invoiceScopes.length,
      privacy: privacyScopes.length,
      native: nativeScopes.length,
      security: 1,
      productOwner: 1,
    },
    filled: {
      tax: 0,
      legal: 0,
      invoice: 0,
      privacy: 0,
      native: 0,
      security: 0,
      productOwner: 0,
    },
    unfilledScopes: [
      ...taxScopes,
      ...legalScopes,
      ...invoiceScopes,
      ...privacyScopes,
      ...nativeScopes,
      ...globalScopes,
    ].map((s) => s.scopeId),
    scopes: {
      tax: taxScopes,
      legal: legalScopes,
      invoice: invoiceScopes,
      privacy: privacyScopes,
      native: nativeScopes,
      global: globalScopes,
    },
    criticalPathCountries,
    estimatedReviewSequence: sequence,
    dependencies,
    note: "No reviewer names invented. All scopes currently unfilled — AWAITING_EXTERNAL_REVIEWERS.",
  };
}
