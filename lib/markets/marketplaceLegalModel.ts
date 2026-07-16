/**
 * Marketplace / supplier-of-record model per country (Phase 15G.1).
 * Status starts DRAFT — READY_FOR_GLOBAL_CUTOVER requires APPROVED.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";

export type MarketplaceModelStatus = "DRAFT" | "REVIEWED" | "APPROVED" | "BLOCKED";

export type MarketplaceLegalModel = {
  countryCode: CountryCode;
  platformLegalRole: string;
  supplierOfFood: "provider" | "platform" | "split";
  contractingParty: "provider" | "platform" | "split";
  invoiceIssuer: "provider" | "platform" | "split";
  taxLiableParty: "provider" | "platform" | "customer" | "split";
  refundCreditOwner: "provider" | "platform" | "split";
  commissionInvoiceIssuer: "platform";
  commissionTaxTreatment: "pending_legal";
  deliveryResponsibility: "provider" | "platform" | "third_party" | "split";
  allergenInfoResponsibility: "provider";
  dataControllerRole: "platform" | "provider" | "joint";
  dataProcessorRole: "platform" | "provider" | "none";
  commissionBps: 500;
  status: MarketplaceModelStatus;
  notes: string;
};

const DEFAULT: Omit<MarketplaceLegalModel, "countryCode"> = {
  platformLegalRole: "disclosed_agent",
  supplierOfFood: "provider",
  contractingParty: "provider",
  invoiceIssuer: "provider",
  taxLiableParty: "provider",
  refundCreditOwner: "provider",
  commissionInvoiceIssuer: "platform",
  commissionTaxTreatment: "pending_legal",
  deliveryResponsibility: "provider",
  allergenInfoResponsibility: "provider",
  dataControllerRole: "platform",
  dataProcessorRole: "platform",
  commissionBps: 500,
  status: "DRAFT",
  notes:
    "Draft commercial default: provider supplies food and invoices company; platform invoices 5% commission. Requires country legal + tax approval before cutover.",
};

export const MARKETPLACE_LEGAL_MODELS: Record<CountryCode, MarketplaceLegalModel> =
  Object.fromEntries(
    SUPPORTED_COUNTRY_CODES.map((c) => [c, { countryCode: c, ...DEFAULT }]),
  ) as Record<CountryCode, MarketplaceLegalModel>;

export function countMarketplaceApprovals(): Record<MarketplaceModelStatus, number> {
  const out: Record<MarketplaceModelStatus, number> = {
    DRAFT: 0,
    REVIEWED: 0,
    APPROVED: 0,
    BLOCKED: 0,
  };
  for (const c of SUPPORTED_COUNTRY_CODES) {
    out[MARKETPLACE_LEGAL_MODELS[c].status] += 1;
  }
  return out;
}

export function assertMarketplaceApprovedForCutover(countryCode: CountryCode): void {
  const m = MARKETPLACE_LEGAL_MODELS[countryCode];
  if (m.status !== "APPROVED") {
    throw new Error(`MARKETPLACE_MODEL_NOT_APPROVED:${countryCode}:${m.status}`);
  }
  if (m.commissionBps !== 500) {
    throw new Error(`COMMISSION_BPS_INVALID:${countryCode}:${m.commissionBps}`);
  }
}
