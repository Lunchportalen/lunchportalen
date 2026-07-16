/**
 * TECHNICAL_21_COMPLETE evaluator (Phase 15G.2).
 * Distinct from GLOBAL_21_READY (which requires human approvals).
 */

import { evaluateGlobal21Ready } from "@/lib/markets/globalActivationGate";
import { countUsJurisdictionCoverage } from "@/lib/tax/jurisdictions/usStates";
import { countCanadaJurisdictionCoverage } from "@/lib/tax/jurisdictions/canadaProvinces";
import { assertAllInvoicePacksPresent, COUNTRY_INVOICE_PACKS } from "@/lib/invoice/countryInvoicePacks";
import { buildLegalDocumentMatrix } from "@/lib/legal/legalDocumentRegistry";
import { credentialDependencies } from "@/lib/invoice/eInvoiceAdapters";
import { SUPPORTED_COUNTRY_CODES, MARKET_LOCALE_CODES, SUPPORTED_LANGUAGES } from "@/lib/markets/supportedMarkets";
import { LAUNCH_CURRENCY_CODES } from "@/lib/money/minorUnits";

export type TechnicalCompletionReport = {
  technical21Complete: boolean;
  global21Ready: boolean;
  decision: "TECHNICAL_21_COMPLETE" | "AWAITING_EXTERNAL_APPROVAL" | "GLOBAL_21_READY" | "NO-GO";
  blockers: string[];
  coverage: {
    countries: number;
    locales: number;
    languages: number;
    currencies: number;
    usSupportedOrNa: number;
    usBlocked: number;
    caSupportedOrNa: number;
    caBlocked: number;
    invoicePacks: number;
    legalDocs: number;
    credentialDependencies: number;
  };
};

export function evaluateTechnical21Complete(args: {
  fullCiGreen: boolean;
  stagingCountriesPassed: number;
  stagingLocalesPassed: number;
  unresolvedP0P1: number;
  rollbackCertified: boolean;
}): TechnicalCompletionReport {
  assertAllInvoicePacksPresent();
  const global = evaluateGlobal21Ready({ stagingGoldenPathPass: args.stagingCountriesPassed });
  const us = countUsJurisdictionCoverage();
  const ca = countCanadaJurisdictionCoverage();
  const legalDocs = buildLegalDocumentMatrix().length;
  const creds = credentialDependencies();

  const blockers: string[] = [];
  if (!args.fullCiGreen) blockers.push("FULL_CI_NOT_GREEN");
  if (args.stagingCountriesPassed < 21) blockers.push(`STAGING_COUNTRIES:${args.stagingCountriesPassed}/21`);
  if (args.stagingLocalesPassed < 24) blockers.push(`STAGING_LOCALES:${args.stagingLocalesPassed}/24`);
  if (args.unresolvedP0P1 > 0) blockers.push(`P0_P1:${args.unresolvedP0P1}`);
  if (!args.rollbackCertified) blockers.push("ROLLBACK_NOT_CERTIFIED");
  if (us.supported + us.notApplicable < 51) {
    blockers.push(`US_LAUNCH_FOOTPRINT:${us.supported + us.notApplicable}/51`);
  }
  if (ca.supported + ca.notApplicable < 13) {
    blockers.push(`CA_LAUNCH_FOOTPRINT:${ca.supported + ca.notApplicable}/13`);
  }
  if (Object.values(COUNTRY_INVOICE_PACKS).length < 21) blockers.push("INVOICE_PACKS_INCOMPLETE");
  if (LAUNCH_CURRENCY_CODES.length < 11) blockers.push("CURRENCIES_INCOMPLETE");
  if (MARKET_LOCALE_CODES.length < 24) blockers.push("LOCALES_INCOMPLETE");
  if (SUPPORTED_LANGUAGES.length < 15) blockers.push("LANGUAGES_INCOMPLETE");

  const technical21Complete = blockers.length === 0;
  let decision: TechnicalCompletionReport["decision"] = "NO-GO";
  if (technical21Complete && global.global21Ready) decision = "GLOBAL_21_READY";
  else if (technical21Complete) decision = "AWAITING_EXTERNAL_APPROVAL";
  else decision = "NO-GO";

  return {
    technical21Complete,
    global21Ready: global.global21Ready,
    decision,
    blockers,
    coverage: {
      countries: SUPPORTED_COUNTRY_CODES.length,
      locales: MARKET_LOCALE_CODES.length,
      languages: SUPPORTED_LANGUAGES.length,
      currencies: LAUNCH_CURRENCY_CODES.length,
      usSupportedOrNa: us.supported + us.notApplicable,
      usBlocked: us.blocked,
      caSupportedOrNa: ca.supported + ca.notApplicable,
      caBlocked: ca.blocked,
      invoicePacks: Object.keys(COUNTRY_INVOICE_PACKS).length,
      legalDocs,
      credentialDependencies: creds.length,
    },
  };
}
