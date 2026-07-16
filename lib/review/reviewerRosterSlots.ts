/**
 * Phase 15G.3A — reviewer roster slots.
 *
 * Empty by design until real humans are onboarded.
 * Never invents names, organizations, or credentials.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_MARKET_LOCALES } from "@/lib/i18n/localeRegistry";
import type { ReviewerRole } from "@/lib/review/reviewWorkflow";

export type ReviewerSlotStatus = "REVIEWER_REQUIRED" | "ASSIGNED" | "EXPIRED";

export type ReviewerSlot = {
  slotId: string;
  role: ReviewerRole;
  /** Empty until a real reviewer is onboarded. */
  reviewerId: string | null;
  organization: string | null;
  credentialReference: string | null;
  countryScope: readonly CountryCode[] | "ALL";
  localeScope: readonly string[] | "ALL" | null;
  permittedApprovalTypes: readonly string[];
  validFrom: string | null;
  validTo: string | null;
  conflictOfInterestDeclared: boolean;
  authenticationMethod: string | null;
  status: ReviewerSlotStatus;
};

const TAX_SLOTS: ReviewerSlot[] = SUPPORTED_COUNTRY_CODES.map((cc) => ({
  slotId: `tax-${cc}`,
  role: "tax_reviewer" as const,
  reviewerId: null,
  organization: null,
  credentialReference: null,
  countryScope: [cc],
  localeScope: null,
  permittedApprovalTypes: ["TAX_APPROVAL", "INVOICE_APPROVAL", "E_INVOICE_APPROVAL"],
  validFrom: null,
  validTo: null,
  conflictOfInterestDeclared: false,
  authenticationMethod: null,
  status: "REVIEWER_REQUIRED" as const,
}));

const LEGAL_SLOTS: ReviewerSlot[] = SUPPORTED_COUNTRY_CODES.map((cc) => ({
  slotId: `legal-${cc}`,
  role: "legal_reviewer" as const,
  reviewerId: null,
  organization: null,
  credentialReference: null,
  countryScope: [cc],
  localeScope: null,
  permittedApprovalTypes: ["LEGAL_APPROVAL", "PRIVACY_APPROVAL", "INVOICE_APPROVAL", "E_INVOICE_APPROVAL"],
  validFrom: null,
  validTo: null,
  conflictOfInterestDeclared: false,
  authenticationMethod: null,
  status: "REVIEWER_REQUIRED" as const,
}));

const NATIVE_SLOTS: ReviewerSlot[] = SUPPORTED_MARKET_LOCALES.map((m) => ({
  slotId: `native-${m.locale}`,
  role: "native_language_reviewer" as const,
  reviewerId: null,
  organization: null,
  credentialReference: null,
  countryScope: [m.countryCode as CountryCode],
  localeScope: [m.locale],
  permittedApprovalTypes: ["NATIVE_LOCALIZATION_APPROVAL"],
  validFrom: null,
  validTo: null,
  conflictOfInterestDeclared: false,
  authenticationMethod: null,
  status: "REVIEWER_REQUIRED" as const,
}));

const GLOBAL_SLOTS: ReviewerSlot[] = [
  {
    slotId: "security-global",
    role: "security_reviewer",
    reviewerId: null,
    organization: null,
    credentialReference: null,
    countryScope: "ALL",
    localeScope: "ALL",
    permittedApprovalTypes: ["SECURITY_APPROVAL", "PRIVACY_APPROVAL"],
    validFrom: null,
    validTo: null,
    conflictOfInterestDeclared: false,
    authenticationMethod: null,
    status: "REVIEWER_REQUIRED",
  },
  {
    slotId: "product-owner-global",
    role: "product_owner",
    reviewerId: null,
    organization: null,
    credentialReference: null,
    countryScope: "ALL",
    localeScope: null,
    permittedApprovalTypes: ["PRODUCT_OWNER_APPROVAL"],
    validFrom: null,
    validTo: null,
    conflictOfInterestDeclared: false,
    authenticationMethod: null,
    status: "REVIEWER_REQUIRED",
  },
];

/** All required reviewer slots. None are assigned until humans are onboarded. */
export const REVIEWER_ROSTER_SLOTS: readonly ReviewerSlot[] = [
  ...TAX_SLOTS,
  ...LEGAL_SLOTS,
  ...NATIVE_SLOTS,
  ...GLOBAL_SLOTS,
];

export function countReviewerRoster(): {
  totalSlots: number;
  assigned: number;
  reviewerRequired: number;
  expired: number;
  taxSlotsRequired: number;
  legalSlotsRequired: number;
  nativeSlotsRequired: number;
  missingScopes: string[];
} {
  const assigned = REVIEWER_ROSTER_SLOTS.filter((s) => s.status === "ASSIGNED").length;
  const reviewerRequired = REVIEWER_ROSTER_SLOTS.filter((s) => s.status === "REVIEWER_REQUIRED").length;
  const expired = REVIEWER_ROSTER_SLOTS.filter((s) => s.status === "EXPIRED").length;
  return {
    totalSlots: REVIEWER_ROSTER_SLOTS.length,
    assigned,
    reviewerRequired,
    expired,
    taxSlotsRequired: TAX_SLOTS.filter((s) => s.status === "REVIEWER_REQUIRED").length,
    legalSlotsRequired: LEGAL_SLOTS.filter((s) => s.status === "REVIEWER_REQUIRED").length,
    nativeSlotsRequired: NATIVE_SLOTS.filter((s) => s.status === "REVIEWER_REQUIRED").length,
    missingScopes: REVIEWER_ROSTER_SLOTS.filter((s) => s.status === "REVIEWER_REQUIRED").map((s) => s.slotId),
  };
}

export function assertNoFabricatedReviewers(): void {
  for (const s of REVIEWER_ROSTER_SLOTS) {
    if (s.reviewerId || s.organization || s.credentialReference) {
      throw new Error(`FABRICATED_REVIEWER_FORBIDDEN:${s.slotId}`);
    }
  }
}
