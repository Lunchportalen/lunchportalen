/**
 * USA launch footprint — 50 states + DC.
 * coverageStatus stays BLOCKED_MISSING_EVIDENCE until per-jurisdiction
 * prepared-food / catering / marketplace rules are human-approved with DOR evidence.
 * No national flat sales-tax fallback.
 */

export type UsJurisdictionSupportStatus =
  | "SUPPORTED"
  | "NOT_APPLICABLE"
  | "BLOCKED_MISSING_EVIDENCE";

export type UsStateJurisdiction = {
  stateCode: string;
  name: string;
  officialDorUrl: string;
  coverageStatus: UsJurisdictionSupportStatus;
  /** County/local hierarchy supported in resolver model (data may still be empty). */
  localHierarchySupported: true;
  preparedFoodModel: "PENDING_DOR_EVIDENCE";
  marketplaceFacilitator: "PENDING_DOR_EVIDENCE";
  nexusPermit: "PENDING_DOR_EVIDENCE";
  openQuestions: readonly string[];
};

const OPEN: readonly string[] = [
  "Confirm prepared food / catering / hot takeaway rate and base from state DOR primary publication.",
  "Confirm delivery fee and service fee taxability.",
  "Confirm gratuity / mandatory service charge treatment.",
  "Confirm marketplace facilitator determination for Lunchportalen model.",
  "Confirm exemption certificate acceptance flow.",
  "Confirm effective date and local (county/city) overlays if any.",
] as const;

/** Seeded official DOR home URLs — pointers only; not rate approvals. */
export const US_STATE_JURISDICTIONS: readonly UsStateJurisdiction[] = [
  { stateCode: "AL", name: "Alabama", officialDorUrl: "https://www.revenue.alabama.gov/" },
  { stateCode: "AK", name: "Alaska", officialDorUrl: "https://tax.alaska.gov/" },
  { stateCode: "AZ", name: "Arizona", officialDorUrl: "https://azdor.gov/" },
  { stateCode: "AR", name: "Arkansas", officialDorUrl: "https://www.dfa.arkansas.gov/" },
  { stateCode: "CA", name: "California", officialDorUrl: "https://www.cdtfa.ca.gov/" },
  { stateCode: "CO", name: "Colorado", officialDorUrl: "https://tax.colorado.gov/" },
  { stateCode: "CT", name: "Connecticut", officialDorUrl: "https://portal.ct.gov/DRS" },
  { stateCode: "DE", name: "Delaware", officialDorUrl: "https://revenue.delaware.gov/" },
  { stateCode: "DC", name: "District of Columbia", officialDorUrl: "https://otr.cfo.dc.gov/" },
  { stateCode: "FL", name: "Florida", officialDorUrl: "https://floridarevenue.com/" },
  { stateCode: "GA", name: "Georgia", officialDorUrl: "https://dor.georgia.gov/" },
  { stateCode: "HI", name: "Hawaii", officialDorUrl: "https://tax.hawaii.gov/" },
  { stateCode: "ID", name: "Idaho", officialDorUrl: "https://tax.idaho.gov/" },
  { stateCode: "IL", name: "Illinois", officialDorUrl: "https://tax.illinois.gov/" },
  { stateCode: "IN", name: "Indiana", officialDorUrl: "https://www.in.gov/dor/" },
  { stateCode: "IA", name: "Iowa", officialDorUrl: "https://tax.iowa.gov/" },
  { stateCode: "KS", name: "Kansas", officialDorUrl: "https://www.ksrevenue.gov/" },
  { stateCode: "KY", name: "Kentucky", officialDorUrl: "https://revenue.ky.gov/" },
  { stateCode: "LA", name: "Louisiana", officialDorUrl: "https://revenue.louisiana.gov/" },
  { stateCode: "ME", name: "Maine", officialDorUrl: "https://www.maine.gov/revenue/" },
  { stateCode: "MD", name: "Maryland", officialDorUrl: "https://www.marylandtaxes.gov/" },
  {
    stateCode: "MA",
    name: "Massachusetts",
    officialDorUrl: "https://www.mass.gov/orgs/massachusetts-department-of-revenue",
  },
  { stateCode: "MI", name: "Michigan", officialDorUrl: "https://www.michigan.gov/taxes" },
  { stateCode: "MN", name: "Minnesota", officialDorUrl: "https://www.revenue.state.mn.us/" },
  { stateCode: "MS", name: "Mississippi", officialDorUrl: "https://www.dor.ms.gov/" },
  { stateCode: "MO", name: "Missouri", officialDorUrl: "https://dor.mo.gov/" },
  { stateCode: "MT", name: "Montana", officialDorUrl: "https://mtrevenue.gov/" },
  { stateCode: "NE", name: "Nebraska", officialDorUrl: "https://revenue.nebraska.gov/" },
  { stateCode: "NV", name: "Nevada", officialDorUrl: "https://tax.nv.gov/" },
  { stateCode: "NH", name: "New Hampshire", officialDorUrl: "https://www.revenue.nh.gov/" },
  { stateCode: "NJ", name: "New Jersey", officialDorUrl: "https://www.nj.gov/treasury/taxation/" },
  { stateCode: "NM", name: "New Mexico", officialDorUrl: "https://www.tax.newmexico.gov/" },
  { stateCode: "NY", name: "New York", officialDorUrl: "https://www.tax.ny.gov/" },
  { stateCode: "NC", name: "North Carolina", officialDorUrl: "https://www.ncdor.gov/" },
  { stateCode: "ND", name: "North Dakota", officialDorUrl: "https://www.tax.nd.gov/" },
  { stateCode: "OH", name: "Ohio", officialDorUrl: "https://tax.ohio.gov/" },
  { stateCode: "OK", name: "Oklahoma", officialDorUrl: "https://oklahoma.gov/tax.html" },
  { stateCode: "OR", name: "Oregon", officialDorUrl: "https://www.oregon.gov/dor/" },
  { stateCode: "PA", name: "Pennsylvania", officialDorUrl: "https://www.revenue.pa.gov/" },
  { stateCode: "RI", name: "Rhode Island", officialDorUrl: "https://tax.ri.gov/" },
  { stateCode: "SC", name: "South Carolina", officialDorUrl: "https://dor.sc.gov/" },
  { stateCode: "SD", name: "South Dakota", officialDorUrl: "https://dor.sd.gov/" },
  { stateCode: "TN", name: "Tennessee", officialDorUrl: "https://www.tn.gov/revenue.html" },
  { stateCode: "TX", name: "Texas", officialDorUrl: "https://comptroller.texas.gov/taxes/" },
  { stateCode: "UT", name: "Utah", officialDorUrl: "https://tax.utah.gov/" },
  { stateCode: "VT", name: "Vermont", officialDorUrl: "https://tax.vermont.gov/" },
  { stateCode: "VA", name: "Virginia", officialDorUrl: "https://www.tax.virginia.gov/" },
  { stateCode: "WA", name: "Washington", officialDorUrl: "https://dor.wa.gov/" },
  { stateCode: "WV", name: "West Virginia", officialDorUrl: "https://tax.wv.gov/" },
  { stateCode: "WI", name: "Wisconsin", officialDorUrl: "https://www.revenue.wi.gov/" },
  { stateCode: "WY", name: "Wyoming", officialDorUrl: "https://revenue.wyo.gov/" },
].map((row) => ({
  ...row,
  coverageStatus: "BLOCKED_MISSING_EVIDENCE" as const,
  localHierarchySupported: true as const,
  preparedFoodModel: "PENDING_DOR_EVIDENCE" as const,
  marketplaceFacilitator: "PENDING_DOR_EVIDENCE" as const,
  nexusPermit: "PENDING_DOR_EVIDENCE" as const,
  openQuestions: OPEN,
}));

export function countUsJurisdictionCoverage(): {
  total: number;
  supported: number;
  notApplicable: number;
  blocked: number;
} {
  return {
    total: US_STATE_JURISDICTIONS.length,
    supported: US_STATE_JURISDICTIONS.filter((j) => j.coverageStatus === "SUPPORTED").length,
    notApplicable: US_STATE_JURISDICTIONS.filter((j) => j.coverageStatus === "NOT_APPLICABLE").length,
    blocked: US_STATE_JURISDICTIONS.filter((j) => j.coverageStatus === "BLOCKED_MISSING_EVIDENCE").length,
  };
}

export function resolveUsJurisdiction(stateCode: string | null | undefined): UsStateJurisdiction | null {
  if (!stateCode) return null;
  const code = stateCode.trim().toUpperCase();
  return US_STATE_JURISDICTIONS.find((j) => j.stateCode === code) ?? null;
}

/** Onboarding / order path: fail closed unless SUPPORTED. */
export function assertUsJurisdictionLaunchable(stateCode: string): void {
  const j = resolveUsJurisdiction(stateCode);
  if (!j) throw new Error(`US_JURISDICTION_UNKNOWN:${stateCode}`);
  if (j.coverageStatus !== "SUPPORTED" && j.coverageStatus !== "NOT_APPLICABLE") {
    throw new Error(`US_JURISDICTION_BLOCKED:${j.stateCode}:${j.coverageStatus}`);
  }
}
