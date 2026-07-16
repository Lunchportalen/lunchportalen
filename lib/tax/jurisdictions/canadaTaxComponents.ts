/**
 * Canada multi-component tax model (GST/HST/PST/QST).
 * Components are RESEARCHED candidates from CRA calculator — never APPROVED here.
 * Resolver/onboarding remain fail-closed until human APPROVED rules exist.
 */

import {
  CANADA_PROVINCE_JURISDICTIONS,
  resolveCanadaJurisdiction,
  type CanadaProvinceJurisdiction,
} from "@/lib/tax/jurisdictions/canadaProvinces";
import { taxOnExclusiveBase } from "@/lib/money/minorUnits";

export type CanadaTaxComponent = {
  code: "GST" | "HST" | "PST" | "QST";
  /** GST/HST/PST: integer bps (10000=100%). QST: deci-bps (9975 ⇒ 9.975% = 9975/100000). */
  rateBpsResearched: number;
  reviewStatus: "RESEARCHED";
};

/** Apply researched component — QST uses 1e5 denominator for 9.975%. */
export function applyResearchedComponent(baseMinor: bigint, component: CanadaTaxComponent): bigint {
  if (component.code === "QST") {
    const scaled = baseMinor * BigInt(component.rateBpsResearched);
    const denom = BigInt(100_000);
    return (scaled + denom / BigInt(2)) / denom;
  }
  return taxOnExclusiveBase(baseMinor, component.rateBpsResearched);
}

export type CanadaComponentQuote =
  | {
      ok: true;
      mode: "RESEARCHED_PREVIEW_ONLY";
      province: CanadaProvinceJurisdiction;
      components: CanadaTaxComponent[];
      /** Preview only — must not be used for production invoices. */
      previewTaxMinor: bigint;
      warning: "NOT_APPROVED_FAIL_CLOSED_FOR_BILLING";
    }
  | {
      ok: false;
      code: "PROVINCE_REQUIRED" | "PROVINCE_UNKNOWN" | "JURISDICTION_BLOCKED" | "BILLING_FORBIDDEN";
      message: string;
    };

export function researchedComponentsForProvince(code: string): CanadaTaxComponent[] | null {
  const p = resolveCanadaJurisdiction(code);
  if (!p) return null;
  if (p.taxModel === "HST") {
    return [{ code: "HST", rateBpsResearched: p.gstOrHstBpsResearched, reviewStatus: "RESEARCHED" }];
  }
  if (p.taxModel === "GST") {
    return [{ code: "GST", rateBpsResearched: p.gstOrHstBpsResearched, reviewStatus: "RESEARCHED" }];
  }
  if (p.taxModel === "GST_PST") {
    return [
      { code: "GST", rateBpsResearched: p.gstOrHstBpsResearched, reviewStatus: "RESEARCHED" },
      { code: "PST", rateBpsResearched: p.provincialBpsResearched ?? 0, reviewStatus: "RESEARCHED" },
    ];
  }
  // GST_QST
  return [
    { code: "GST", rateBpsResearched: p.gstOrHstBpsResearched, reviewStatus: "RESEARCHED" },
    { code: "QST", rateBpsResearched: p.provincialBpsResearched ?? 0, reviewStatus: "RESEARCHED" },
  ];
}

/**
 * Preview quote for reviewers/tests. Billing path must call assertCanadaBillingAllowed first.
 */
export function previewCanadaTaxComponents(args: {
  provinceCode: string | null | undefined;
  taxableBaseMinor: bigint;
  allowBilling: boolean;
}): CanadaComponentQuote {
  const code = String(args.provinceCode ?? "").trim().toUpperCase();
  if (!code) {
    return { ok: false, code: "PROVINCE_REQUIRED", message: "CA province/territory required" };
  }
  const province = resolveCanadaJurisdiction(code);
  if (!province) {
    return { ok: false, code: "PROVINCE_UNKNOWN", message: `Unknown CA jurisdiction ${code}` };
  }
  if (province.coverageStatus === "BLOCKED_MISSING_EVIDENCE" && args.allowBilling) {
    return {
      ok: false,
      code: "JURISDICTION_BLOCKED",
      message: `CA/${code} blocked for billing until food/place-of-supply APPROVED`,
    };
  }
  if (args.allowBilling) {
    return {
      ok: false,
      code: "BILLING_FORBIDDEN",
      message: "Canada researched preview must not bill — APPROVED rules required",
    };
  }
  const components = researchedComponentsForProvince(code)!;
  let preview = BigInt(0);
  for (const c of components) {
    preview += applyResearchedComponent(args.taxableBaseMinor, c);
  }
  return {
    ok: true,
    mode: "RESEARCHED_PREVIEW_ONLY",
    province,
    components,
    previewTaxMinor: preview,
    warning: "NOT_APPROVED_FAIL_CLOSED_FOR_BILLING",
  };
}

export function assertCanadaComponentsComplete(): void {
  if (CANADA_PROVINCE_JURISDICTIONS.length !== 13) {
    throw new Error(`CA_JURISDICTION_COUNT:${CANADA_PROVINCE_JURISDICTIONS.length}`);
  }
  for (const p of CANADA_PROVINCE_JURISDICTIONS) {
    const comps = researchedComponentsForProvince(p.code);
    if (!comps || comps.length === 0) throw new Error(`CA_COMPONENTS_MISSING:${p.code}`);
    const sum = comps.reduce((a, c) => a + c.rateBpsResearched, 0);
    if (p.taxModel === "HST" && sum !== p.gstOrHstBpsResearched) {
      throw new Error(`CA_HST_COMPONENT_MISMATCH:${p.code}`);
    }
  }
}
