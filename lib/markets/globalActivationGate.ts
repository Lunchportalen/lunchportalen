/**
 * All-or-nothing GLOBAL_21_READY gate (Phase 15G.1).
 * Counts must come from real approval records — never inferred from scaffolding.
 */

import { countTaxPacksByStatus } from "@/lib/tax/packs/countryTaxPacks";
import { countUsJurisdictionCoverage } from "@/lib/tax/jurisdictions/usStates";
import { countCanadaJurisdictionCoverage } from "@/lib/tax/jurisdictions/canadaProvinces";
import { countMarketplaceApprovals } from "@/lib/markets/marketplaceLegalModel";
import { countEInvoiceApprovals } from "@/lib/invoice/eInvoiceRegistry";
import { countLegalDocumentApprovals } from "@/lib/legal/legalDocumentRegistry";
import { countResearchedRules } from "@/lib/tax/rules/researchedCountryRules";
import { LAUNCH_CURRENCY_CODES } from "@/lib/money/minorUnits";

export type GlobalReadinessReport = {
  countriesTechnicallyScaffolded: number;
  taxApproved: number;
  legalApprovedCountries: number;
  invoiceApproved: number;
  eInvoiceApprovedOrNa: number;
  privacyApproved: number;
  nativeLocalesApproved: number;
  currenciesCertified: number;
  usSupported: number;
  caSupported: number;
  marketplaceApproved: number;
  researchedRules: number;
  forgedTaxApprovals: number;
  global21Ready: boolean;
  decision: "GLOBAL_21_READY" | "BUILT_BUT_NOT_LEGALLY_APPROVED" | "NO-GO";
  blockers: string[];
};

/**
 * Honest readiness snapshot. Does not invent approvals.
 * invoiceApproved / legalApprovedCountries stay 0 until human systems write APPROVED.
 */
export function evaluateGlobal21Ready(overrides?: {
  taxApproved?: number;
  legalApprovedCountries?: number;
  invoiceApproved?: number;
  privacyApproved?: number;
  stagingGoldenPathPass?: number;
}): GlobalReadinessReport {
  const tax = countTaxPacksByStatus();
  const us = countUsJurisdictionCoverage();
  const ca = countCanadaJurisdictionCoverage();
  const market = countMarketplaceApprovals();
  const eInv = countEInvoiceApprovals();
  const legal = countLegalDocumentApprovals();
  const rules = countResearchedRules();

  const taxApproved = overrides?.taxApproved ?? tax.APPROVED;
  const legalApprovedCountries = overrides?.legalApprovedCountries ?? 0;
  const invoiceApproved = overrides?.invoiceApproved ?? 0;
  const privacyApproved = overrides?.privacyApproved ?? legal.privacyApproved;
  const stagingGoldenPathPass = overrides?.stagingGoldenPathPass ?? 0;

  const blockers: string[] = [];
  if (taxApproved < 21) blockers.push(`TAX_APPROVED:${taxApproved}/21`);
  if (legalApprovedCountries < 21) blockers.push(`LEGAL_APPROVED:${legalApprovedCountries}/21`);
  if (invoiceApproved < 21) blockers.push(`INVOICE_APPROVED:${invoiceApproved}/21`);
  if (eInv.approvedOrNa < 21) blockers.push(`E_INVOICE_APPROVED_OR_NA:${eInv.approvedOrNa}/21`);
  if (privacyApproved < 21) blockers.push(`PRIVACY_APPROVED:${privacyApproved}/21`);
  if (legal.nativeApprovedLocales < 24) {
    blockers.push(`NATIVE_LOCALE_APPROVED:${legal.nativeApprovedLocales}/24`);
  }
  if (us.supported + us.notApplicable < 51) {
    blockers.push(`US_JURISDICTIONS:${us.supported + us.notApplicable}/51`);
  }
  if (ca.supported + ca.notApplicable < 13) {
    blockers.push(`CA_JURISDICTIONS:${ca.supported + ca.notApplicable}/13`);
  }
  if (market.APPROVED < 21) blockers.push(`MARKETPLACE_APPROVED:${market.APPROVED}/21`);
  if (LAUNCH_CURRENCY_CODES.length < 11) blockers.push("CURRENCIES<11");
  if (stagingGoldenPathPass < 21) blockers.push(`STAGING_GOLDEN_PATH:${stagingGoldenPathPass}/21`);
  if (rules.approved > 0) blockers.push(`UNEXPECTED_FORGED_RULE_APPROVALS:${rules.approved}`);

  const global21Ready = blockers.length === 0;
  let decision: GlobalReadinessReport["decision"] = "NO-GO";
  if (global21Ready) decision = "GLOBAL_21_READY";
  else if (tax.RESEARCHED >= 21 && us.total === 51 && ca.total === 13) {
    decision = "BUILT_BUT_NOT_LEGALLY_APPROVED";
  }

  return {
    countriesTechnicallyScaffolded: 21,
    taxApproved,
    legalApprovedCountries,
    invoiceApproved,
    eInvoiceApprovedOrNa: eInv.approvedOrNa,
    privacyApproved,
    nativeLocalesApproved: legal.nativeApprovedLocales,
    currenciesCertified: LAUNCH_CURRENCY_CODES.length,
    usSupported: us.supported,
    caSupported: ca.supported,
    marketplaceApproved: market.APPROVED,
    researchedRules: rules.researched,
    forgedTaxApprovals: rules.approved,
    global21Ready,
    decision,
    blockers,
  };
}
