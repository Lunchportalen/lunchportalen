/**
 * Vendor-agnostic tax jurisdiction provider contracts (Phase 15G.2B).
 */

export type JurisdictionTechnicalStatus =
  | "TECHNICALLY_SUPPORTED"
  | "TECHNICALLY_BLOCKED"
  | "NOT_APPLICABLE"
  | "EXTERNAL_CREDENTIAL_REQUIRED"
  | "EXTERNAL_REVIEW_REQUIRED";

export type AddressInput = {
  countryCode: string;
  subdivisionCode?: string | null;
  countyFips?: string | null;
  city?: string | null;
  postalCode?: string | null;
  line1?: string | null;
};

export type ResolvedAuthority = {
  authorityCode: string;
  name: string;
  officialUrl: string | null;
};

export type RateLine = {
  authorityCode: string;
  taxName: string;
  rateBps: number;
  /** QST uses deci-bps (9975 ⇒ 9.975%). */
  rateScale: "bps_1e4" | "deci_bps_1e5";
  inclusive: boolean;
};

export type ProductTaxability = {
  category: string;
  taxable: boolean;
  rateLines: RateLine[];
  notes: string;
};

export type ProviderSnapshotMeta = {
  providerName: string;
  providerVersion: string;
  requestedAt: string;
  evidenceReference: string | null;
};

export type ResolveAddressResult =
  | {
      ok: true;
      jurisdictionPath: string;
      technicalStatus: JurisdictionTechnicalStatus;
      authorities: ResolvedAuthority[];
      meta: ProviderSnapshotMeta;
    }
  | {
      ok: false;
      code: "UNKNOWN" | "AMBIGUOUS" | "TIMEOUT" | "BLOCKED" | "UNSUPPORTED_COUNTRY";
      message: string;
      meta: ProviderSnapshotMeta;
    };

export type ResolveRatesResult =
  | {
      ok: true;
      jurisdictionPath: string;
      technicalStatus: JurisdictionTechnicalStatus;
      rateLines: RateLine[];
      effectiveFrom: string;
      effectiveTo: string | null;
      meta: ProviderSnapshotMeta;
    }
  | {
      ok: false;
      code: "NO_RATE" | "BLOCKED" | "TIMEOUT" | "CREDENTIAL_REQUIRED";
      message: string;
      meta: ProviderSnapshotMeta;
    };

export interface TaxJurisdictionProvider {
  readonly name: string;
  readonly version: string;
  resolveAddress(input: AddressInput, requestedAt: string): ResolveAddressResult;
  resolveAuthorities(jurisdictionPath: string, requestedAt: string): ResolvedAuthority[];
  resolveRates(args: {
    jurisdictionPath: string;
    category: string;
    requestedAt: string;
  }): ResolveRatesResult;
  resolveProductTaxability(args: {
    jurisdictionPath: string;
    category: string;
    requestedAt: string;
  }): ProductTaxability | null;
  resolveFeeTaxability(args: {
    jurisdictionPath: string;
    feeType: "delivery_fee" | "service_fee" | "gratuity";
    requestedAt: string;
  }): ProductTaxability | null;
  resolveNexusRequirements(subdivisionCode: string): {
    registrationLikelyRequired: boolean;
    marketplaceFacilitatorApplicable: boolean | null;
    notes: string;
  };
  validateExemption(args: {
    jurisdictionPath: string;
    certificateId: string | null;
  }): { ok: boolean; code: string };
  getEffectiveDate(jurisdictionPath: string): string | null;
  getEvidenceReference(jurisdictionPath: string): string | null;
}
