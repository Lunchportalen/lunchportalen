/**
 * Phase 16NO — Immutable global commercial model for all 21 countries.
 * COMMERCIAL_MODEL_ID = agency_commission_invoice_only_v1
 *
 * Country tax treatment may vary. The agency model must not.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";
import { LP_GLOBAL_COMMISSION_RATE_BPS } from "@/lib/billing/globalCommission";

export const COMMERCIAL_MODEL_ID = "agency_commission_invoice_only_v1" as const;
export const COMMISSION_RATE_BPS = 500 as const;
export const NO_PLATFORM_TAX_CODE = "NO_PLATFORM_SERVICE_STANDARD_VAT_25" as const;
export const NO_PLATFORM_VAT_BPS = 2500 as const;

export type CountryCommercialInvariant = {
  countryCode: CountryCode;
  commercialModelId: typeof COMMERCIAL_MODEL_ID;
  providerIsFoodSeller: true;
  providerInvoicesCustomer: true;
  platformIsFoodSeller: false;
  platformInvoicesProvider: true;
  platformCollectsCustomerFunds: false;
  commissionRateBps: typeof COMMISSION_RATE_BPS;
  commissionBase: "net_excluding_customer_tax";
  paymentMode: "invoice_only";
  stripeEnabled: false;
  productionEnabled: boolean;
  taxProfileStatus: "approved_norway" | "pending_external_approval";
};

/** Server-enforced production eligibility — defaults keep non-NO disabled. */
export function isCountryProductionEnabled(countryCode: CountryCode): boolean {
  if (countryCode !== "NO") return false;
  return (
    process.env.COUNTRY_NO_PRODUCTION_ENABLED === "true" &&
    process.env.ACCOUNTANT_NORWAY_TAX_CONFIRMATION === "CONFIRMED"
  );
}

export function buildCountryInvariant(countryCode: CountryCode): CountryCommercialInvariant {
  return {
    countryCode,
    commercialModelId: COMMERCIAL_MODEL_ID,
    providerIsFoodSeller: true,
    providerInvoicesCustomer: true,
    platformIsFoodSeller: false,
    platformInvoicesProvider: true,
    platformCollectsCustomerFunds: false,
    commissionRateBps: COMMISSION_RATE_BPS,
    commissionBase: "net_excluding_customer_tax",
    paymentMode: "invoice_only",
    stripeEnabled: false,
    productionEnabled: isCountryProductionEnabled(countryCode),
    taxProfileStatus:
      countryCode === "NO" && process.env.ACCOUNTANT_NORWAY_TAX_CONFIRMATION === "CONFIRMED"
        ? "approved_norway"
        : "pending_external_approval",
  };
}

export function assertGlobalCommercialModelLocked(): void {
  if (LP_GLOBAL_COMMISSION_RATE_BPS !== COMMISSION_RATE_BPS) {
    throw new Error(`COMMISSION_RATE_DRIFT:${LP_GLOBAL_COMMISSION_RATE_BPS}`);
  }
  for (const c of SUPPORTED_COUNTRY_CODES) {
    const inv = buildCountryInvariant(c);
    if (inv.commissionRateBps !== 500) throw new Error(`COMMISSION_BPS:${c}`);
    if (inv.providerIsFoodSeller !== true) throw new Error(`PROVIDER_NOT_SELLER:${c}`);
    if (inv.platformIsFoodSeller !== false) throw new Error(`PLATFORM_IS_SELLER:${c}`);
    if (inv.platformCollectsCustomerFunds !== false) throw new Error(`PLATFORM_COLLECTS:${c}`);
    if (inv.paymentMode !== "invoice_only") throw new Error(`PAYMENT_MODE:${c}`);
    if (inv.stripeEnabled !== false) throw new Error(`STRIPE_ON:${c}`);
    if (c !== "NO" && inv.productionEnabled) {
      throw new Error(`NON_NO_PRODUCTION_ENABLED:${c}`);
    }
  }
}

/** Norway platform invoice example: 10_000 net → 500 + 125 = 625. */
export function norwayPlatformInvoiceExample(customerNetMinor: bigint = BigInt(1_000_000)): {
  customerNetMinor: bigint;
  foodMvaMinor: bigint;
  customerGrossMinor: bigint;
  commissionNetMinor: bigint;
  commissionMvaMinor: bigint;
  platformInvoiceTotalMinor: bigint;
  taxCode: typeof NO_PLATFORM_TAX_CODE;
} {
  const tenThousand = BigInt(10_000);
  const commissionNetMinor = (customerNetMinor * BigInt(COMMISSION_RATE_BPS)) / tenThousand;
  const commissionMvaMinor = (commissionNetMinor * BigInt(NO_PLATFORM_VAT_BPS)) / tenThousand;
  const foodMvaMinor = (customerNetMinor * BigInt(1500)) / tenThousand;
  return {
    customerNetMinor,
    foodMvaMinor,
    customerGrossMinor: customerNetMinor + foodMvaMinor,
    commissionNetMinor,
    commissionMvaMinor,
    platformInvoiceTotalMinor: commissionNetMinor + commissionMvaMinor,
    taxCode: NO_PLATFORM_TAX_CODE,
  };
}

export const NORWAY_PLATFORM_INVOICE_WORDING =
  "Provisjon for tilgang til og bruk av Lunchportalen. 5 % av netto ordreverdi ekskl. merverdiavgift.";
