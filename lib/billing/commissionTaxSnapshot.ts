/**
 * Immutable 5% platform commission + tax treatment snapshot (Phase 15G.2).
 * Commission amount is exact; commission tax remains fail-closed until APPROVED.
 */

import { platformCommissionMinor } from "@/lib/money/minorUnits";
import { resolveTax, type TaxRuleRecord, TAX_ENGINE_VERSION } from "@/lib/tax/engine/resolver";
import type { CountryCode } from "@/lib/markets/supportedMarkets";

export type CommissionSnapshot = {
  countryCode: CountryCode;
  currencyCode: string;
  orderNetMinor: bigint;
  commissionBps: 500;
  commissionMinor: bigint;
  commissionTax: {
    status: "OK" | "FAIL_CLOSED";
    rateBps: number | null;
    taxMinor: bigint | null;
    ruleId: string | null;
    failCode: string | null;
  };
  engineVersion: string;
  capturedAt: string;
};

export function buildCommissionSnapshot(args: {
  countryCode: CountryCode;
  currencyCode: string;
  orderNetMinor: bigint;
  taxPointDate: string;
  rules: readonly TaxRuleRecord[];
  subdivisionCode?: string | null;
  capturedAt: string;
}): CommissionSnapshot {
  const commission = platformCommissionMinor(args.orderNetMinor, args.currencyCode);
  if (commission.amountMinor * BigInt(20) !== args.orderNetMinor && args.orderNetMinor % BigInt(20) === BigInt(0)) {
    // exact 5% when divisible; platformCommissionMinor already half-up
  }
  const tax = resolveTax({
    countryCode: args.countryCode,
    currencyCode: args.currencyCode,
    taxCategory: "platform_commission",
    customerType: "B2B",
    fulfillmentType: "delivery",
    taxableBaseMinor: commission.amountMinor,
    taxPointDate: args.taxPointDate,
    subdivisionCode: args.subdivisionCode,
    rules: args.rules,
  });

  const commissionTax = tax.ok
    ? {
        status: "OK" as const,
        rateBps: tax.rateBps,
        taxMinor: tax.taxAmountMinor,
        ruleId: tax.ruleId,
        failCode: null,
      }
    : {
        status: "FAIL_CLOSED" as const,
        rateBps: null,
        taxMinor: null,
        ruleId: null,
        failCode: tax.ok === false ? tax.code : "TAX_RULE_MISSING",
      };

  return {
    countryCode: args.countryCode,
    currencyCode: args.currencyCode,
    orderNetMinor: args.orderNetMinor,
    commissionBps: 500,
    commissionMinor: commission.amountMinor,
    commissionTax,
    engineVersion: TAX_ENGINE_VERSION,
    capturedAt: args.capturedAt,
  };
}

export function assertCommissionExactFivePercent(orderNetMinor: bigint, commissionMinor: bigint): void {
  const viaHelper = platformCommissionMinor(orderNetMinor, "NOK").amountMinor;
  if (commissionMinor !== viaHelper) {
    throw new Error(`COMMISSION_IMBALANCE:${commissionMinor}!=${viaHelper}`);
  }
}
