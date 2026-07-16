/**
 * Effective-dated RESEARCHED tax rule candidates for launch countries.
 * NEVER APPROVED in this module. Resolver will fail-closed until human APPROVED.
 *
 * Sources used for research pointers (not legal approval):
 * - NO: Skatteetaten merverdiavgiftssatser 2026 (25% / 15% næringsmidler / 12% selected)
 * - GB: HMRC VAT Notice 709/1 + VAT rates guidance (standard catering/hot; zero cold takeaway)
 * - CA: CRA GST/HST calculator (province rates) — food classification still open
 */

import type { TaxRuleRecord } from "@/lib/tax/engine/resolver";
import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";

function rule(
  partial: Omit<TaxRuleRecord, "reviewStatus" | "inclusive" | "reverseCharge" | "exemptionCode" | "customerType" | "fulfillmentType"> &
    Partial<Pick<TaxRuleRecord, "inclusive" | "reverseCharge" | "exemptionCode" | "customerType" | "fulfillmentType">>,
): TaxRuleRecord {
  return {
    customerType: "any",
    fulfillmentType: "any",
    inclusive: false,
    reverseCharge: false,
    exemptionCode: null,
    reviewStatus: "RESEARCHED",
    ...partial,
  };
}

/** Norway — researched from Skatteetaten 2026 table. Servering vs næringsmidler still open. */
const NO_RULES: TaxRuleRecord[] = [
  rule({
    id: "NO-STD-2026",
    countryCode: "NO",
    jurisdictionPath: "NO",
    taxCategory: "restaurant_service",
    rateBps: 2500,
    taxCode: "NO-MVA-25",
    invoiceWordingKey: "no.mva.standard",
    evidenceId: "src-no-skatteetaten-mva-2026",
    validFrom: "2026-01-01",
    validTo: null,
  }),
  rule({
    id: "NO-FOOD-2026",
    countryCode: "NO",
    jurisdictionPath: "NO",
    taxCategory: "cold_food",
    rateBps: 1500,
    taxCode: "NO-MVA-15-FOOD",
    invoiceWordingKey: "no.mva.food",
    evidenceId: "src-no-skatteetaten-mva-2026",
    validFrom: "2026-01-01",
    validTo: null,
  }),
  rule({
    id: "NO-HOT-OPEN",
    countryCode: "NO",
    jurisdictionPath: "NO",
    taxCategory: "hot_food",
    rateBps: 2500,
    taxCode: "NO-MVA-HOT-CANDIDATE",
    invoiceWordingKey: "no.mva.standard",
    evidenceId: "src-no-skatteetaten-mva-2026",
    validFrom: "2026-01-01",
    validTo: null,
  }),
  rule({
    id: "NO-COMMISSION",
    countryCode: "NO",
    jurisdictionPath: "NO",
    taxCategory: "platform_commission",
    rateBps: 2500,
    taxCode: "NO-MVA-COMMISSION-CANDIDATE",
    invoiceWordingKey: "no.mva.standard",
    evidenceId: "src-no-skatteetaten-mva-2026",
    validFrom: "2026-01-01",
    validTo: null,
  }),
];

/** GB — researched from HMRC notices; cold takeaway often 0%, catering/hot standard 20%. */
const GB_RULES: TaxRuleRecord[] = [
  rule({
    id: "GB-STD-CATERING",
    countryCode: "GB",
    jurisdictionPath: "GB",
    taxCategory: "catering_service",
    rateBps: 2000,
    taxCode: "GB-VAT-STD",
    invoiceWordingKey: "gb.vat.standard",
    evidenceId: "src-gb-hmrc-709-1",
    validFrom: "2012-10-01",
    validTo: null,
  }),
  rule({
    id: "GB-HOT-TAKEAWAY",
    countryCode: "GB",
    jurisdictionPath: "GB",
    taxCategory: "hot_food",
    fulfillmentType: "takeaway",
    rateBps: 2000,
    taxCode: "GB-VAT-HOT-TAKEAWAY",
    invoiceWordingKey: "gb.vat.standard",
    evidenceId: "src-gb-hmrc-709-1",
    validFrom: "2012-10-01",
    validTo: null,
  }),
  rule({
    id: "GB-COLD-TAKEAWAY-ZERO",
    countryCode: "GB",
    jurisdictionPath: "GB",
    taxCategory: "cold_food",
    fulfillmentType: "takeaway",
    rateBps: 0,
    taxCode: "GB-VAT-ZERO-COLD",
    invoiceWordingKey: "gb.vat.zero",
    evidenceId: "src-gb-hmrc-vat-rates",
    validFrom: "2012-10-01",
    validTo: null,
  }),
  rule({
    id: "GB-ON-PREMISE",
    countryCode: "GB",
    jurisdictionPath: "GB",
    taxCategory: "restaurant_service",
    fulfillmentType: "on_premise",
    rateBps: 2000,
    taxCode: "GB-VAT-ON-PREMISE",
    invoiceWordingKey: "gb.vat.standard",
    evidenceId: "src-gb-hmrc-709-1",
    validFrom: "2012-10-01",
    validTo: null,
  }),
];

/** Placeholder researched scaffolding for remaining VAT markets — rates must be filled from national primary law before PENDING_REVIEW. */
function vatScaffold(country: CountryCode, evidenceId: string): TaxRuleRecord[] {
  return [
    rule({
      id: `${country}-STD-SCAFFOLD`,
      countryCode: country,
      jurisdictionPath: country,
      taxCategory: "prepared_food",
      rateBps: 0,
      taxCode: `${country}-VAT-PENDING-PRIMARY`,
      invoiceWordingKey: null,
      evidenceId,
      validFrom: "2026-01-01",
      validTo: null,
      exemptionCode: "RATE_PENDING_PRIMARY_SOURCE",
    }),
  ];
}

const EU_SCAFFOLD_COUNTRIES: CountryCode[] = [
  "SE", "DK", "FI", "DE", "FR", "ES", "IT", "NL", "BE", "CH", "AT", "IE", "PL", "RO", "CZ", "PT", "GR",
];

function buildResearchedRulesByCountry(): Record<CountryCode, readonly TaxRuleRecord[]> {
  const out = {} as Record<CountryCode, readonly TaxRuleRecord[]>;
  for (const c of SUPPORTED_COUNTRY_CODES) {
    out[c] = [];
  }
  out.NO = NO_RULES;
  out.GB = GB_RULES;
  out.US = []; // subdivision-only; no national flat rules
  out.CA = []; // province-only; see canadaProvinces researched bps
  for (const c of EU_SCAFFOLD_COUNTRIES) {
    out[c] = vatScaffold(c, `src-${c.toLowerCase()}-national-home`);
  }
  return out;
}

export const RESEARCHED_TAX_RULES_BY_COUNTRY: Record<CountryCode, readonly TaxRuleRecord[]> =
  buildResearchedRulesByCountry();

export function allResearchedTaxRules(): TaxRuleRecord[] {
  return SUPPORTED_COUNTRY_CODES.flatMap((c) => [...RESEARCHED_TAX_RULES_BY_COUNTRY[c]]);
}

export function countResearchedRules(): { total: number; approved: number; researched: number } {
  const all = allResearchedTaxRules();
  return {
    total: all.length,
    approved: all.filter((r) => r.reviewStatus === "APPROVED").length,
    researched: all.filter((r) => r.reviewStatus === "RESEARCHED").length,
  };
}

export function assertNoForgedTaxApprovals(): void {
  const forged = allResearchedTaxRules().filter((r) => r.reviewStatus === "APPROVED");
  if (forged.length > 0) {
    throw new Error(`FORGED_TAX_APPROVAL:${forged.map((r) => r.id).join(",")}`);
  }
}
