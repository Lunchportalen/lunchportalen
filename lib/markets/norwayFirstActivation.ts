/**
 * Phase 16NO — Norway-first production activation (server-enforced).
 * Other 20 countries remain production-disabled.
 *
 * Owner waived accountant confirmation for cutover.
 * NORWAY_TAX_MODEL_STATUS = OWNER_APPROVED_WITH_OFFICIAL_SOURCE_SUPPORT
 * Real platform MVA invoice issuance requires verified Merverdiavgiftsregisteret registration.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";

export const NORWAY_TAX_MODEL_STATUS = "OWNER_APPROVED_WITH_OFFICIAL_SOURCE_SUPPORT" as const;

export type NorwayActivationFlags = {
  COUNTRY_NO_PRODUCTION_ENABLED: boolean;
  COUNTRY_NO_REGISTRATION_ENABLED: boolean;
  COUNTRY_NO_ORDERING_ENABLED: boolean;
  COUNTRY_NO_INVOICE_ONLY_ENABLED: boolean;
  COUNTRY_NO_PLATFORM_COMMISSION_ENABLED: boolean;
  OWNER_NORWAY_TAX_MODEL_CONFIRMATION: "CONFIRMED" | "REQUIRED" | "UNKNOWN";
  OWNER_ACCEPTS_NORWAY_TAX_CLASSIFICATION_RESPONSIBILITY: boolean;
  ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER: boolean;
  /** Kept for audit/legacy; NOT a cutover blocker when waived. */
  ACCOUNTANT_NORWAY_TAX_CONFIRMATION: "CONFIRMED" | "REQUIRED" | "UNKNOWN" | "NOT_REQUIRED_FOR_CUTOVER";
  LUNCHPORTALEN_MVA_REGISTERED: boolean;
  PLATFORM_INVOICE_VAT_25_ENABLED: boolean;
};

function envBool(name: string): boolean {
  const v = String(process.env[name] || "").trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1";
}

function envOwnerTriState(name: string, fallback: "REQUIRED" | "UNKNOWN" = "REQUIRED"): "CONFIRMED" | "REQUIRED" | "UNKNOWN" {
  const v = String(process.env[name] || fallback).toUpperCase();
  if (v === "CONFIRMED") return "CONFIRMED";
  if (v === "UNKNOWN") return "UNKNOWN";
  return "REQUIRED";
}

function envAccountantTriState(
  name: string,
  fallback: "REQUIRED" | "UNKNOWN" | "NOT_REQUIRED_FOR_CUTOVER" = "REQUIRED",
): "CONFIRMED" | "REQUIRED" | "UNKNOWN" | "NOT_REQUIRED_FOR_CUTOVER" {
  const v = String(process.env[name] || fallback).toUpperCase();
  if (v === "CONFIRMED") return "CONFIRMED";
  if (v === "UNKNOWN") return "UNKNOWN";
  if (v === "NOT_REQUIRED_FOR_CUTOVER") return "NOT_REQUIRED_FOR_CUTOVER";
  return "REQUIRED";
}

export function readNorwayActivationFlags(): NorwayActivationFlags {
  const mvaRegistered = envBool("LUNCHPORTALEN_MVA_REGISTERED");
  const vatEligibleRaw = String(process.env.PLATFORM_INVOICE_VAT_25_ENABLED || "").trim().toUpperCase();
  const vatEnabled =
    vatEligibleRaw === "TRUE" ||
    vatEligibleRaw === "YES" ||
    vatEligibleRaw === "ELIGIBLE" ||
    (vatEligibleRaw === "" && mvaRegistered);

  return {
    COUNTRY_NO_PRODUCTION_ENABLED: envBool("COUNTRY_NO_PRODUCTION_ENABLED"),
    COUNTRY_NO_REGISTRATION_ENABLED: envBool("COUNTRY_NO_REGISTRATION_ENABLED"),
    COUNTRY_NO_ORDERING_ENABLED: envBool("COUNTRY_NO_ORDERING_ENABLED"),
    COUNTRY_NO_INVOICE_ONLY_ENABLED: envBool("COUNTRY_NO_INVOICE_ONLY_ENABLED"),
    COUNTRY_NO_PLATFORM_COMMISSION_ENABLED: envBool("COUNTRY_NO_PLATFORM_COMMISSION_ENABLED"),
    OWNER_NORWAY_TAX_MODEL_CONFIRMATION: envOwnerTriState("OWNER_NORWAY_TAX_MODEL_CONFIRMATION", "REQUIRED"),
    OWNER_ACCEPTS_NORWAY_TAX_CLASSIFICATION_RESPONSIBILITY: envBool(
      "OWNER_ACCEPTS_NORWAY_TAX_CLASSIFICATION_RESPONSIBILITY",
    ),
    ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER: envBool("ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER"),
    ACCOUNTANT_NORWAY_TAX_CONFIRMATION: envAccountantTriState(
      "ACCOUNTANT_NORWAY_TAX_CONFIRMATION",
      "NOT_REQUIRED_FOR_CUTOVER",
    ),
    LUNCHPORTALEN_MVA_REGISTERED: mvaRegistered,
    PLATFORM_INVOICE_VAT_25_ENABLED: vatEnabled && mvaRegistered,
  };
}

export function isOwnerTaxCutoverApproved(flags: NorwayActivationFlags = readNorwayActivationFlags()): boolean {
  if (flags.OWNER_NORWAY_TAX_MODEL_CONFIRMATION !== "CONFIRMED") return false;
  if (!flags.OWNER_ACCEPTS_NORWAY_TAX_CLASSIFICATION_RESPONSIBILITY) return false;
  if (flags.ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER) return true;
  return (
    flags.ACCOUNTANT_NORWAY_TAX_CONFIRMATION === "CONFIRMED" ||
    flags.ACCOUNTANT_NORWAY_TAX_CONFIRMATION === "NOT_REQUIRED_FOR_CUTOVER"
  );
}

export function isOtherCountryProductionBlocked(countryCode: CountryCode): boolean {
  if (countryCode === "NO") return false;
  return true;
}

/** Real platform invoices that charge 25% MVA — blocked until Merverdiavgiftsregisteret = YES. */
export function assertPlatformMvaInvoiceAllowed(): void {
  const flags = readNorwayActivationFlags();
  if (!flags.LUNCHPORTALEN_MVA_REGISTERED || !flags.PLATFORM_INVOICE_VAT_25_ENABLED) {
    throw Object.assign(new Error("PLATFORM_MVA_INVOICE_REQUIRES_MVA_REGISTRATION"), {
      code: "PLATFORM_MVA_INVOICE_REQUIRES_MVA_REGISTRATION",
      LUNCHPORTALEN_MVA_REGISTERED: flags.LUNCHPORTALEN_MVA_REGISTERED,
      PLATFORM_INVOICE_VAT_25_ENABLED: flags.PLATFORM_INVOICE_VAT_25_ENABLED,
    });
  }
}

export function assertCountryMarketAccess(
  countryCode: string,
  action: "register" | "order" | "invoice" | "commission" | "platform_mva_invoice",
): void {
  const cc = String(countryCode || "").trim().toUpperCase() as CountryCode;
  if (!SUPPORTED_COUNTRY_CODES.includes(cc)) {
    throw Object.assign(new Error("UNKNOWN_COUNTRY"), { code: "UNKNOWN_COUNTRY", countryCode: cc });
  }
  if (cc !== "NO") {
    throw Object.assign(new Error("COUNTRY_PRODUCTION_DISABLED"), {
      code: "COUNTRY_PRODUCTION_DISABLED",
      countryCode: cc,
      action,
    });
  }
  const flags = readNorwayActivationFlags();
  if (!isOwnerTaxCutoverApproved(flags)) {
    throw Object.assign(new Error("OWNER_NORWAY_TAX_CUTOVER_NOT_APPROVED"), {
      code: "OWNER_NORWAY_TAX_CUTOVER_NOT_APPROVED",
      action,
    });
  }
  if (!flags.COUNTRY_NO_PRODUCTION_ENABLED) {
    throw Object.assign(new Error("NORWAY_PRODUCTION_DISABLED"), { code: "NORWAY_PRODUCTION_DISABLED", action });
  }
  if (action === "register" && !flags.COUNTRY_NO_REGISTRATION_ENABLED) {
    throw Object.assign(new Error("NORWAY_REGISTRATION_DISABLED"), { code: "NORWAY_REGISTRATION_DISABLED" });
  }
  if (action === "order" && !flags.COUNTRY_NO_ORDERING_ENABLED) {
    throw Object.assign(new Error("NORWAY_ORDERING_DISABLED"), { code: "NORWAY_ORDERING_DISABLED" });
  }
  if (action === "invoice" && !flags.COUNTRY_NO_INVOICE_ONLY_ENABLED) {
    throw Object.assign(new Error("NORWAY_INVOICE_DISABLED"), { code: "NORWAY_INVOICE_DISABLED" });
  }
  if (action === "commission" && !flags.COUNTRY_NO_PLATFORM_COMMISSION_ENABLED) {
    throw Object.assign(new Error("NORWAY_COMMISSION_DISABLED"), { code: "NORWAY_COMMISSION_DISABLED" });
  }
  if (action === "platform_mva_invoice") {
    assertPlatformMvaInvoiceAllowed();
  }
}

export function evaluateNorwayFirstReadiness(): {
  decision:
    | "NORWAY_LIVE"
    | "NORWAY_TECHNICALLY_LIVE_PLATFORM_INVOICING_AWAITS_MVA_REGISTRATION"
    | "NORWAY_DARK_DEPLOY_ONLY"
    | "NO-GO";
  flags: NorwayActivationFlags;
  otherCountriesDisabled: number;
  blockers: string[];
  ownerTaxModelConfirmed: boolean;
  accountantConfirmationRequired: false;
  accountantConfirmationWaivedByOwner: boolean;
  mvaRegistered: boolean;
  norwayTaxModelStatus: typeof NORWAY_TAX_MODEL_STATUS;
} {
  const flags = readNorwayActivationFlags();
  const blockers: string[] = [];
  const ownerTaxModelConfirmed = flags.OWNER_NORWAY_TAX_MODEL_CONFIRMATION === "CONFIRMED";
  if (!ownerTaxModelConfirmed) blockers.push("OWNER_NORWAY_TAX_MODEL_CONFIRMATION_REQUIRED");
  if (!flags.OWNER_ACCEPTS_NORWAY_TAX_CLASSIFICATION_RESPONSIBILITY) {
    blockers.push("OWNER_TAX_RESPONSIBILITY_NOT_ACCEPTED");
  }
  if (!flags.ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER && flags.ACCOUNTANT_NORWAY_TAX_CONFIRMATION === "REQUIRED") {
    blockers.push("ACCOUNTANT_OR_OWNER_WAIVER_REQUIRED");
  }
  const otherCountriesDisabled = SUPPORTED_COUNTRY_CODES.filter((c) => c !== "NO").length;
  if (otherCountriesDisabled !== 20) blockers.push("COUNTRY_COUNT_DRIFT");

  if (blockers.length > 0) {
    return {
      decision: "NO-GO",
      flags,
      otherCountriesDisabled,
      blockers,
      ownerTaxModelConfirmed,
      accountantConfirmationRequired: false,
      accountantConfirmationWaivedByOwner: flags.ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER,
      mvaRegistered: flags.LUNCHPORTALEN_MVA_REGISTERED,
      norwayTaxModelStatus: NORWAY_TAX_MODEL_STATUS,
    };
  }

  const technicallyLive =
    flags.COUNTRY_NO_PRODUCTION_ENABLED &&
    flags.COUNTRY_NO_REGISTRATION_ENABLED &&
    flags.COUNTRY_NO_ORDERING_ENABLED &&
    flags.COUNTRY_NO_INVOICE_ONLY_ENABLED &&
    flags.COUNTRY_NO_PLATFORM_COMMISSION_ENABLED;

  if (technicallyLive && flags.LUNCHPORTALEN_MVA_REGISTERED && flags.PLATFORM_INVOICE_VAT_25_ENABLED) {
    return {
      decision: "NORWAY_LIVE",
      flags,
      otherCountriesDisabled,
      blockers,
      ownerTaxModelConfirmed,
      accountantConfirmationRequired: false,
      accountantConfirmationWaivedByOwner: flags.ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER,
      mvaRegistered: true,
      norwayTaxModelStatus: NORWAY_TAX_MODEL_STATUS,
    };
  }

  if (technicallyLive) {
    return {
      decision: "NORWAY_TECHNICALLY_LIVE_PLATFORM_INVOICING_AWAITS_MVA_REGISTRATION",
      flags,
      otherCountriesDisabled,
      blockers: [...blockers, "LUNCHPORTALEN_MVA_REGISTRATION_REQUIRED_FOR_REAL_VAT_INVOICE"],
      ownerTaxModelConfirmed,
      accountantConfirmationRequired: false,
      accountantConfirmationWaivedByOwner: flags.ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER,
      mvaRegistered: false,
      norwayTaxModelStatus: NORWAY_TAX_MODEL_STATUS,
    };
  }

  return {
    decision: "NORWAY_DARK_DEPLOY_ONLY",
    flags,
    otherCountriesDisabled,
    blockers: [...blockers, "NORWAY_FLAGS_NOT_FULLY_ENABLED"],
    ownerTaxModelConfirmed,
    accountantConfirmationRequired: false,
    accountantConfirmationWaivedByOwner: flags.ACCOUNTANT_CONFIRMATION_WAIVED_BY_OWNER,
    mvaRegistered: flags.LUNCHPORTALEN_MVA_REGISTERED,
    norwayTaxModelStatus: NORWAY_TAX_MODEL_STATUS,
  };
}
