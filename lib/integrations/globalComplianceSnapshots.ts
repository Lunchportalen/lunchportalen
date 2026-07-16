/**
 * Order/billing snapshot contracts for tax/legal/currency truth (Phase 15G.1).
 * Snapshots are immutable inputs for ledger — never recompute silently from language.
 */

export type MarketSnapshot = {
  countryCode: string;
  currencyCode: string;
  locale: string;
  jurisdictionPath: string;
  commercialModelVersion: string;
  capturedAt: string;
};

export type TaxRuleSnapshot = {
  ruleId: string | null;
  evidenceId: string | null;
  rateBps: number | null;
  inclusive: boolean | null;
  reverseCharge: boolean;
  engineVersion: string;
  resolveStatus: "OK" | "FAIL_CLOSED";
  failCode: string | null;
};

export type OrderComplianceSnapshot = {
  market: MarketSnapshot;
  tax: TaxRuleSnapshot;
  legalPackVersion: string | null;
  commissionBps: 500;
};

export function buildFailClosedOrderSnapshot(args: {
  countryCode: string;
  currencyCode: string;
  locale: string;
  jurisdictionPath: string;
  failCode: string;
  engineVersion: string;
  capturedAt: string;
}): OrderComplianceSnapshot {
  return {
    market: {
      countryCode: args.countryCode,
      currencyCode: args.currencyCode,
      locale: args.locale,
      jurisdictionPath: args.jurisdictionPath,
      commercialModelVersion: "draft-5pct-disclosed-agent",
      capturedAt: args.capturedAt,
    },
    tax: {
      ruleId: null,
      evidenceId: null,
      rateBps: null,
      inclusive: null,
      reverseCharge: false,
      engineVersion: args.engineVersion,
      resolveStatus: "FAIL_CLOSED",
      failCode: args.failCode,
    },
    legalPackVersion: null,
    commissionBps: 500,
  };
}
