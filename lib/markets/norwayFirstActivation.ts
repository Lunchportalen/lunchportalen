/**
 * Phase 16NO — Norway-first production activation (server-enforced).
 * Other 20 countries remain production-disabled.
 * Fiscal activation requires ACCOUNTANT_NORWAY_TAX_CONFIRMATION=CONFIRMED.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";

export type NorwayActivationFlags = {
  COUNTRY_NO_PRODUCTION_ENABLED: boolean;
  COUNTRY_NO_REGISTRATION_ENABLED: boolean;
  COUNTRY_NO_ORDERING_ENABLED: boolean;
  COUNTRY_NO_INVOICE_ONLY_ENABLED: boolean;
  COUNTRY_NO_PLATFORM_COMMISSION_ENABLED: boolean;
  OWNER_NORWAY_TAX_MODEL_CONFIRMATION: "CONFIRMED" | "REQUIRED" | "UNKNOWN";
  ACCOUNTANT_NORWAY_TAX_CONFIRMATION: "CONFIRMED" | "REQUIRED" | "UNKNOWN";
};

function envBool(name: string): boolean {
  return process.env[name] === "true";
}

function envTriState(name: string, fallback: "REQUIRED" | "UNKNOWN" = "REQUIRED"): "CONFIRMED" | "REQUIRED" | "UNKNOWN" {
  const v = String(process.env[name] || fallback).toUpperCase();
  if (v === "CONFIRMED") return "CONFIRMED";
  if (v === "UNKNOWN") return "UNKNOWN";
  return "REQUIRED";
}

export function readNorwayActivationFlags(): NorwayActivationFlags {
  return {
    COUNTRY_NO_PRODUCTION_ENABLED: envBool("COUNTRY_NO_PRODUCTION_ENABLED"),
    COUNTRY_NO_REGISTRATION_ENABLED: envBool("COUNTRY_NO_REGISTRATION_ENABLED"),
    COUNTRY_NO_ORDERING_ENABLED: envBool("COUNTRY_NO_ORDERING_ENABLED"),
    COUNTRY_NO_INVOICE_ONLY_ENABLED: envBool("COUNTRY_NO_INVOICE_ONLY_ENABLED"),
    COUNTRY_NO_PLATFORM_COMMISSION_ENABLED: envBool("COUNTRY_NO_PLATFORM_COMMISSION_ENABLED"),
    // Owner confirmation is recorded in evidence; default CONFIRMED only when explicitly set.
    OWNER_NORWAY_TAX_MODEL_CONFIRMATION: envTriState("OWNER_NORWAY_TAX_MODEL_CONFIRMATION", "REQUIRED"),
    ACCOUNTANT_NORWAY_TAX_CONFIRMATION: envTriState("ACCOUNTANT_NORWAY_TAX_CONFIRMATION", "REQUIRED"),
  };
}

export function isOtherCountryProductionBlocked(countryCode: CountryCode): boolean {
  if (countryCode === "NO") return false;
  return true;
}

export function assertCountryMarketAccess(countryCode: string, action: "register" | "order" | "invoice" | "commission"): void {
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
  if (flags.ACCOUNTANT_NORWAY_TAX_CONFIRMATION !== "CONFIRMED") {
    throw Object.assign(new Error("ACCOUNTANT_NORWAY_TAX_CONFIRMATION_REQUIRED"), {
      code: "ACCOUNTANT_NORWAY_TAX_CONFIRMATION_REQUIRED",
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
}

export function evaluateNorwayFirstReadiness(): {
  decision:
    | "NORWAY_LIVE"
    | "NORWAY_READY_ACCOUNTANT_CONFIRMATION_REQUIRED"
    | "NORWAY_DARK_DEPLOY_ONLY"
    | "NO-GO";
  flags: NorwayActivationFlags;
  otherCountriesDisabled: number;
  blockers: string[];
  ownerTaxModelConfirmed: boolean;
  accountantTaxConfirmed: boolean;
} {
  const flags = readNorwayActivationFlags();
  const blockers: string[] = [];
  const ownerTaxModelConfirmed = flags.OWNER_NORWAY_TAX_MODEL_CONFIRMATION === "CONFIRMED";
  const accountantTaxConfirmed = flags.ACCOUNTANT_NORWAY_TAX_CONFIRMATION === "CONFIRMED";
  if (!accountantTaxConfirmed) {
    blockers.push("ACCOUNTANT_NORWAY_TAX_CONFIRMATION_REQUIRED");
  }
  if (!ownerTaxModelConfirmed) {
    blockers.push("OWNER_NORWAY_TAX_MODEL_CONFIRMATION_REQUIRED");
  }
  const otherCountriesDisabled = SUPPORTED_COUNTRY_CODES.filter((c) => c !== "NO").length;
  if (otherCountriesDisabled !== 20) blockers.push("COUNTRY_COUNT_DRIFT");

  if (blockers.includes("ACCOUNTANT_NORWAY_TAX_CONFIRMATION_REQUIRED")) {
    return {
      decision: "NORWAY_READY_ACCOUNTANT_CONFIRMATION_REQUIRED",
      flags,
      otherCountriesDisabled,
      blockers,
      ownerTaxModelConfirmed,
      accountantTaxConfirmed,
    };
  }

  const live =
    flags.COUNTRY_NO_PRODUCTION_ENABLED &&
    flags.COUNTRY_NO_REGISTRATION_ENABLED &&
    flags.COUNTRY_NO_ORDERING_ENABLED &&
    flags.COUNTRY_NO_INVOICE_ONLY_ENABLED &&
    flags.COUNTRY_NO_PLATFORM_COMMISSION_ENABLED;

  if (live) {
    return {
      decision: "NORWAY_LIVE",
      flags,
      otherCountriesDisabled,
      blockers,
      ownerTaxModelConfirmed,
      accountantTaxConfirmed,
    };
  }

  return {
    decision: "NORWAY_DARK_DEPLOY_ONLY",
    flags,
    otherCountriesDisabled,
    blockers: [...blockers, "NORWAY_FLAGS_NOT_FULLY_ENABLED"],
    ownerTaxModelConfirmed,
    accountantTaxConfirmed,
  };
}
