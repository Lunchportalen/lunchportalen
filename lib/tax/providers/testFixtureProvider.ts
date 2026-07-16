/**
 * Deterministic TestFixtureProvider for US/CA technical resolver coverage.
 *
 * IMPORTANT:
 * - Rates here are FIXTURES for technical/staging verification only.
 * - review/legal status remains EXTERNAL_REVIEW_REQUIRED — never TAX_APPROVED.
 * - No national US/CA flat fallback outside explicit subdivision path.
 */

import { US_STATE_JURISDICTIONS } from "@/lib/tax/jurisdictions/usStates";
import { CANADA_PROVINCE_JURISDICTIONS } from "@/lib/tax/jurisdictions/canadaProvinces";
import type {
  AddressInput,
  JurisdictionTechnicalStatus,
  ProductTaxability,
  RateLine,
  ResolveAddressResult,
  ResolveRatesResult,
  ResolvedAuthority,
  TaxJurisdictionProvider,
} from "@/lib/tax/providers/types";

export const TEST_FIXTURE_PROVIDER_VERSION = "15g2b.fixture.1";

/** States with no general statewide sales tax (technical classification). */
const US_NO_STATE_SALES_TAX = new Set(["DE", "MT", "NH", "OR"]);

/** Alaska: no statewide sales tax; local may exist — fixture returns N/A state component. */
const US_STATE_NA_LOCAL_POSSIBLE = new Set(["AK"]);

function meta(requestedAt: string, evidence: string | null) {
  return {
    providerName: "TestFixtureProvider",
    providerVersion: TEST_FIXTURE_PROVIDER_VERSION,
    requestedAt,
    evidenceReference: evidence,
  };
}

function usTechnicalStatus(state: string): JurisdictionTechnicalStatus {
  if (US_NO_STATE_SALES_TAX.has(state) || US_STATE_NA_LOCAL_POSSIBLE.has(state)) {
    return "NOT_APPLICABLE";
  }
  return "TECHNICALLY_SUPPORTED";
}

/** Fixture state rates (bps) — technical only; EXTERNAL_REVIEW_REQUIRED for launch legality. */
const US_FIXTURE_STATE_BPS: Record<string, number> = {
  AL: 400, AZ: 560, AR: 650, CA: 725, CO: 290, CT: 635, DC: 600, FL: 600, GA: 400,
  HI: 400, ID: 600, IL: 625, IN: 700, IA: 600, KS: 650, KY: 600, LA: 445, ME: 550,
  MD: 600, MA: 625, MI: 600, MN: 687, MS: 700, MO: 422, NE: 550, NV: 685, NJ: 662,
  NM: 488, NY: 400, NC: 475, ND: 500, OH: 575, OK: 450, PA: 600, RI: 700, SC: 600,
  SD: 450, TN: 700, TX: 625, UT: 485, VT: 600, VA: 530, WA: 650, WV: 600, WI: 500, WY: 400,
};

function caRateLines(code: string): RateLine[] {
  const p = CANADA_PROVINCE_JURISDICTIONS.find((x) => x.code === code);
  if (!p) return [];
  if (p.taxModel === "HST") {
    return [{ authorityCode: "CRA", taxName: "HST", rateBps: p.gstOrHstBpsResearched, rateScale: "bps_1e4", inclusive: false }];
  }
  if (p.taxModel === "GST") {
    return [{ authorityCode: "CRA", taxName: "GST", rateBps: p.gstOrHstBpsResearched, rateScale: "bps_1e4", inclusive: false }];
  }
  if (p.taxModel === "GST_PST") {
    return [
      { authorityCode: "CRA", taxName: "GST", rateBps: p.gstOrHstBpsResearched, rateScale: "bps_1e4", inclusive: false },
      { authorityCode: `CA-${code}`, taxName: "PST", rateBps: p.provincialBpsResearched ?? 0, rateScale: "bps_1e4", inclusive: false },
    ];
  }
  return [
    { authorityCode: "CRA", taxName: "GST", rateBps: p.gstOrHstBpsResearched, rateScale: "bps_1e4", inclusive: false },
    { authorityCode: "RQ", taxName: "QST", rateBps: p.provincialBpsResearched ?? 0, rateScale: "deci_bps_1e5", inclusive: false },
  ];
}

export class TestFixtureProvider implements TaxJurisdictionProvider {
  readonly name = "TestFixtureProvider";
  readonly version = TEST_FIXTURE_PROVIDER_VERSION;

  resolveAddress(input: AddressInput, requestedAt: string): ResolveAddressResult {
    const country = String(input.countryCode ?? "").toUpperCase();
    const sub = String(input.subdivisionCode ?? "").toUpperCase();
    if (country === "US") {
      if (!sub) {
        return { ok: false, code: "BLOCKED", message: "US subdivision required", meta: meta(requestedAt, null) };
      }
      const st = US_STATE_JURISDICTIONS.find((s) => s.stateCode === sub);
      if (!st) {
        return { ok: false, code: "UNKNOWN", message: `Unknown US state ${sub}`, meta: meta(requestedAt, null) };
      }
      const path = `US/${sub}`;
      return {
        ok: true,
        jurisdictionPath: path,
        technicalStatus: usTechnicalStatus(sub),
        authorities: this.resolveAuthorities(path, requestedAt),
        meta: meta(requestedAt, st.officialDorUrl),
      };
    }
    if (country === "CA") {
      if (!sub) {
        return { ok: false, code: "BLOCKED", message: "CA province required", meta: meta(requestedAt, null) };
      }
      const p = CANADA_PROVINCE_JURISDICTIONS.find((x) => x.code === sub);
      if (!p) {
        return { ok: false, code: "UNKNOWN", message: `Unknown CA province ${sub}`, meta: meta(requestedAt, null) };
      }
      const path = `CA/${sub}`;
      return {
        ok: true,
        jurisdictionPath: path,
        technicalStatus: "TECHNICALLY_SUPPORTED",
        authorities: this.resolveAuthorities(path, requestedAt),
        meta: meta(requestedAt, p.officialFederalSourceUrl),
      };
    }
    return {
      ok: false,
      code: "UNSUPPORTED_COUNTRY",
      message: `TestFixtureProvider supports US/CA only, got ${country}`,
      meta: meta(requestedAt, null),
    };
  }

  resolveAuthorities(jurisdictionPath: string, _requestedAt: string): ResolvedAuthority[] {
    const [country, sub] = jurisdictionPath.split("/");
    if (country === "US" && sub) {
      const st = US_STATE_JURISDICTIONS.find((s) => s.stateCode === sub);
      return [{ authorityCode: `US-${sub}`, name: st?.name ?? sub, officialUrl: st?.officialDorUrl ?? null }];
    }
    if (country === "CA" && sub) {
      return [
        { authorityCode: "CRA", name: "Canada Revenue Agency", officialUrl: "https://www.canada.ca/en/revenue-agency.html" },
        { authorityCode: `CA-${sub}`, name: sub, officialUrl: null },
      ];
    }
    return [];
  }

  resolveRates(args: {
    jurisdictionPath: string;
    category: string;
    requestedAt: string;
  }): ResolveRatesResult {
    const [country, sub] = args.jurisdictionPath.split("/");
    if (country === "US" && sub) {
      const status = usTechnicalStatus(sub);
      if (status === "NOT_APPLICABLE") {
        return {
          ok: true,
          jurisdictionPath: args.jurisdictionPath,
          technicalStatus: "NOT_APPLICABLE",
          rateLines: [],
          effectiveFrom: "2026-01-01",
          effectiveTo: null,
          meta: meta(args.requestedAt, this.getEvidenceReference(args.jurisdictionPath)),
        };
      }
      const bps = US_FIXTURE_STATE_BPS[sub];
      if (bps === undefined) {
        return {
          ok: false,
          code: "NO_RATE",
          message: `No fixture rate for ${sub}`,
          meta: meta(args.requestedAt, null),
        };
      }
      // Local overlays never guessed — state fixture only.
      return {
        ok: true,
        jurisdictionPath: args.jurisdictionPath,
        technicalStatus: "TECHNICALLY_SUPPORTED",
        rateLines: [
          {
            authorityCode: `US-${sub}`,
            taxName: "state_sales_tax_fixture",
            rateBps: bps,
            rateScale: "bps_1e4",
            inclusive: false,
          },
        ],
        effectiveFrom: "2026-01-01",
        effectiveTo: null,
        meta: meta(args.requestedAt, this.getEvidenceReference(args.jurisdictionPath)),
      };
    }
    if (country === "CA" && sub) {
      const lines = caRateLines(sub);
      if (!lines.length) {
        return { ok: false, code: "NO_RATE", message: `No CA fixture for ${sub}`, meta: meta(args.requestedAt, null) };
      }
      return {
        ok: true,
        jurisdictionPath: args.jurisdictionPath,
        technicalStatus: "TECHNICALLY_SUPPORTED",
        rateLines: lines,
        effectiveFrom: "2025-04-01",
        effectiveTo: null,
        meta: meta(args.requestedAt, this.getEvidenceReference(args.jurisdictionPath)),
      };
    }
    return { ok: false, code: "BLOCKED", message: "Unsupported path", meta: meta(args.requestedAt, null) };
  }

  resolveProductTaxability(args: {
    jurisdictionPath: string;
    category: string;
    requestedAt: string;
  }): ProductTaxability | null {
    const rates = this.resolveRates(args);
    if (!rates.ok) return null;
    const foodCats = new Set([
      "cold_food", "hot_food", "prepared_food", "restaurant_service", "catering_service",
      "staffed_catering", "takeaway",
    ]);
    return {
      category: args.category,
      taxable: foodCats.has(args.category) || args.category === "platform_commission",
      rateLines: rates.rateLines,
      notes: "FIXTURE taxability — EXTERNAL_REVIEW_REQUIRED before legal use",
    };
  }

  resolveFeeTaxability(args: {
    jurisdictionPath: string;
    feeType: "delivery_fee" | "service_fee" | "gratuity";
    requestedAt: string;
  }): ProductTaxability | null {
    if (args.feeType === "gratuity") {
      return {
        category: args.feeType,
        taxable: false,
        rateLines: [],
        notes: "Fixture: gratuity non-taxable pending jurisdiction review",
      };
    }
    return this.resolveProductTaxability({
      jurisdictionPath: args.jurisdictionPath,
      category: args.feeType,
      requestedAt: args.requestedAt,
    });
  }

  resolveNexusRequirements(subdivisionCode: string) {
    const sub = subdivisionCode.toUpperCase();
    if (US_NO_STATE_SALES_TAX.has(sub) || US_STATE_NA_LOCAL_POSSIBLE.has(sub)) {
      return {
        registrationLikelyRequired: false,
        marketplaceFacilitatorApplicable: null,
        notes: "No general statewide sales tax in fixture model",
      };
    }
    return {
      registrationLikelyRequired: true,
      marketplaceFacilitatorApplicable: null,
      notes: "Fixture nexus — EXTERNAL_REVIEW_REQUIRED",
    };
  }

  validateExemption(args: { jurisdictionPath: string; certificateId: string | null }) {
    if (!args.certificateId) return { ok: false, code: "CERTIFICATE_REQUIRED" };
    return { ok: true, code: "FIXTURE_ACCEPTED" };
  }

  getEffectiveDate(jurisdictionPath: string): string | null {
    return jurisdictionPath.startsWith("CA/") ? "2025-04-01" : "2026-01-01";
  }

  getEvidenceReference(jurisdictionPath: string): string | null {
    const [country, sub] = jurisdictionPath.split("/");
    if (country === "US" && sub) {
      return US_STATE_JURISDICTIONS.find((s) => s.stateCode === sub)?.officialDorUrl ?? null;
    }
    if (country === "CA" && sub) {
      return CANADA_PROVINCE_JURISDICTIONS.find((p) => p.code === sub)?.officialFederalSourceUrl ?? null;
    }
    return null;
  }
}

export function countUsFixtureCoverage(): {
  paths: number;
  technicallySupported: number;
  notApplicable: number;
  blocked: number;
} {
  let technicallySupported = 0;
  let notApplicable = 0;
  for (const s of US_STATE_JURISDICTIONS) {
    const st = usTechnicalStatus(s.stateCode);
    if (st === "NOT_APPLICABLE") notApplicable += 1;
    else if (st === "TECHNICALLY_SUPPORTED") technicallySupported += 1;
  }
  return {
    paths: US_STATE_JURISDICTIONS.length,
    technicallySupported,
    notApplicable,
    blocked: US_STATE_JURISDICTIONS.length - technicallySupported - notApplicable,
  };
}

export function countCanadaFixtureCoverage(): {
  paths: number;
  technicallySupported: number;
  blocked: number;
} {
  return {
    paths: CANADA_PROVINCE_JURISDICTIONS.length,
    technicallySupported: CANADA_PROVINCE_JURISDICTIONS.length,
    blocked: 0,
  };
}
