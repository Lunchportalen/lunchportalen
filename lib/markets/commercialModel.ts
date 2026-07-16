/**
 * Marketplace / supplier-of-record model per country (Phase 15G).
 * Default is DRAFT disclosed_agent — must be legally approved per country.
 */

import type { CountryCode } from "@/lib/markets/supportedMarkets";
import { SUPPORTED_COUNTRY_CODES } from "@/lib/markets/supportedMarkets";

export type PlatformRole =
  | "agent"
  | "disclosed_agent"
  | "undisclosed_agent"
  | "marketplace_facilitator"
  | "principal_reseller"
  | "software_intermediary";

export type MarketCommercialModel = {
  countryCode: CountryCode;
  platformRole: PlatformRole;
  invoiceIssuer: "provider" | "platform" | "split";
  taxLiableParty: "provider" | "platform" | "customer" | "split";
  commissionBps: 500;
  reviewStatus: "DRAFT" | "RESEARCHED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
};

const DEFAULT: Omit<MarketCommercialModel, "countryCode"> = {
  platformRole: "disclosed_agent",
  invoiceIssuer: "provider",
  taxLiableParty: "provider",
  commissionBps: 500,
  reviewStatus: "DRAFT",
};

export const MARKET_COMMERCIAL_MODELS: Record<CountryCode, MarketCommercialModel> = Object.fromEntries(
  SUPPORTED_COUNTRY_CODES.map((c) => [c, { countryCode: c, ...DEFAULT }]),
) as Record<CountryCode, MarketCommercialModel>;

/** US may require marketplace facilitator analysis — still DRAFT until counsel approves. */
MARKET_COMMERCIAL_MODELS.US = {
  ...MARKET_COMMERCIAL_MODELS.US,
  platformRole: "marketplace_facilitator",
  reviewStatus: "DRAFT",
};

export function assertCommissionIsFivePercent(model: MarketCommercialModel): void {
  if (model.commissionBps !== 500) {
    throw new Error(`COMMISSION_BPS_INVALID:${model.countryCode}:${model.commissionBps}`);
  }
}
