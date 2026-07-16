/**
 * Canada launch footprint — 10 provinces + 3 territories.
 *
 * GST/HST rate candidates are RESEARCHED from CRA official calculator pages.
 * PST/QST and prepared-food classification remain open → coverage BLOCKED until approved.
 * No single Canada flat-rate fallback.
 */

export type CanadaTaxModel = "GST" | "HST" | "GST_PST" | "GST_QST";

export type CanadaJurisdictionSupportStatus =
  | "SUPPORTED"
  | "NOT_APPLICABLE"
  | "BLOCKED_MISSING_EVIDENCE";

export type CanadaProvinceJurisdiction = {
  code: string;
  name: string;
  taxModel: CanadaTaxModel;
  /** Federal GST or combined HST candidate in basis points — RESEARCHED only. */
  gstOrHstBpsResearched: number;
  /** Provincial PST/QST candidate in basis points when applicable — RESEARCHED only. */
  provincialBpsResearched: number | null;
  coverageStatus: CanadaJurisdictionSupportStatus;
  officialFederalSourceUrl: string;
  bilingualLegalOutputRequired: boolean;
  openQuestions: readonly string[];
};

const CRA_RATES =
  "https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/gst-hst-businesses/charge-collect-which-rate/calculator.html";

const OPEN: readonly string[] = [
  "Confirm prepared food / catering / delivery place-of-supply from CRA + provincial statutes.",
  "Confirm zero-rated basic groceries vs taxable prepared meals for Lunchportalen supply types.",
  "Confirm PST/QST registration and invoice wording where applicable.",
  "Confirm bilingual (EN/FR) legal and invoice output requirements for QC and federal packs.",
] as const;

/**
 * Rates as published on CRA GST/HST calculator (retrieved research pointer 2026-07-16).
 * Nova Scotia HST 14% effective 2025-04-01 per CRA.
 * reviewStatus of any derived tax_rule must remain RESEARCHED until human approval.
 */
const CANADA_ROWS: ReadonlyArray<
  Omit<CanadaProvinceJurisdiction, "coverageStatus" | "officialFederalSourceUrl" | "openQuestions">
> = [
  { code: "AB", name: "Alberta", taxModel: "GST", gstOrHstBpsResearched: 500, provincialBpsResearched: null, bilingualLegalOutputRequired: false },
  { code: "BC", name: "British Columbia", taxModel: "GST_PST", gstOrHstBpsResearched: 500, provincialBpsResearched: 700, bilingualLegalOutputRequired: false },
  { code: "MB", name: "Manitoba", taxModel: "GST_PST", gstOrHstBpsResearched: 500, provincialBpsResearched: 700, bilingualLegalOutputRequired: false },
  { code: "NB", name: "New Brunswick", taxModel: "HST", gstOrHstBpsResearched: 1500, provincialBpsResearched: null, bilingualLegalOutputRequired: false },
  { code: "NL", name: "Newfoundland and Labrador", taxModel: "HST", gstOrHstBpsResearched: 1500, provincialBpsResearched: null, bilingualLegalOutputRequired: false },
  { code: "NT", name: "Northwest Territories", taxModel: "GST", gstOrHstBpsResearched: 500, provincialBpsResearched: null, bilingualLegalOutputRequired: false },
  { code: "NS", name: "Nova Scotia", taxModel: "HST", gstOrHstBpsResearched: 1400, provincialBpsResearched: null, bilingualLegalOutputRequired: false },
  { code: "NU", name: "Nunavut", taxModel: "GST", gstOrHstBpsResearched: 500, provincialBpsResearched: null, bilingualLegalOutputRequired: false },
  { code: "ON", name: "Ontario", taxModel: "HST", gstOrHstBpsResearched: 1300, provincialBpsResearched: null, bilingualLegalOutputRequired: false },
  { code: "PE", name: "Prince Edward Island", taxModel: "HST", gstOrHstBpsResearched: 1500, provincialBpsResearched: null, bilingualLegalOutputRequired: false },
  { code: "QC", name: "Quebec", taxModel: "GST_QST", gstOrHstBpsResearched: 500, provincialBpsResearched: 9975, bilingualLegalOutputRequired: true },
  { code: "SK", name: "Saskatchewan", taxModel: "GST_PST", gstOrHstBpsResearched: 500, provincialBpsResearched: 600, bilingualLegalOutputRequired: false },
  { code: "YT", name: "Yukon", taxModel: "GST", gstOrHstBpsResearched: 500, provincialBpsResearched: null, bilingualLegalOutputRequired: false },
];

export const CANADA_PROVINCE_JURISDICTIONS: readonly CanadaProvinceJurisdiction[] = CANADA_ROWS.map((row) => ({
  ...row,
  coverageStatus: "BLOCKED_MISSING_EVIDENCE",
  officialFederalSourceUrl: CRA_RATES,
  openQuestions: OPEN,
}));

export function countCanadaJurisdictionCoverage(): {
  total: number;
  supported: number;
  notApplicable: number;
  blocked: number;
  classified: number;
} {
  return {
    total: CANADA_PROVINCE_JURISDICTIONS.length,
    supported: CANADA_PROVINCE_JURISDICTIONS.filter((j) => j.coverageStatus === "SUPPORTED").length,
    notApplicable: CANADA_PROVINCE_JURISDICTIONS.filter((j) => j.coverageStatus === "NOT_APPLICABLE").length,
    blocked: CANADA_PROVINCE_JURISDICTIONS.filter((j) => j.coverageStatus === "BLOCKED_MISSING_EVIDENCE").length,
    classified: CANADA_PROVINCE_JURISDICTIONS.length,
  };
}

export function resolveCanadaJurisdiction(code: string | null | undefined): CanadaProvinceJurisdiction | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  return CANADA_PROVINCE_JURISDICTIONS.find((j) => j.code === c) ?? null;
}

export function assertCanadaJurisdictionLaunchable(code: string): void {
  const j = resolveCanadaJurisdiction(code);
  if (!j) throw new Error(`CA_JURISDICTION_UNKNOWN:${code}`);
  if (j.coverageStatus !== "SUPPORTED" && j.coverageStatus !== "NOT_APPLICABLE") {
    throw new Error(`CA_JURISDICTION_BLOCKED:${j.code}:${j.coverageStatus}`);
  }
}
