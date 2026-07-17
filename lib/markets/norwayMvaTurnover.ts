/**
 * Phase 16NO.1 — track Lunchportalen AS taxable platform-service turnover
 * (commission net excl. MVA), not catering providers' food sales.
 *
 * Skatteetaten registration threshold for ordinary businesses: 50 000
 * major units (ex VAT) over a 12-month period — owner must register when obligation arises.
 */

export const NORWAY_MVA_REGISTRATION_THRESHOLD_MINOR = BigInt(5_000_000); // 50_000.00 major units
export const NORWAY_MVA_OWNER_ALERT_RATIO_BPS = 8000; // alert at 80% of threshold

export type NorwayMvaTurnoverSnapshot = {
  taxableServiceTurnoverMinor: bigint;
  thresholdMinor: bigint;
  alertAtMinor: bigint;
  remainingMinor: bigint;
  percentOfThresholdBps: number;
  alert: boolean;
  crossed: boolean;
  LUNCHPORTALEN_MVA_REGISTERED: boolean;
  PLATFORM_REAL_MVA_INVOICING: "BLOCKED" | "ELIGIBLE";
  ownerActionPath: string;
};

export function evaluateNorwayMvaTurnover(input: {
  taxableServiceTurnoverMinor: bigint | number | string;
  mvaRegistered?: boolean;
}): NorwayMvaTurnoverSnapshot {
  const turnover =
    typeof input.taxableServiceTurnoverMinor === "bigint"
      ? input.taxableServiceTurnoverMinor
      : BigInt(input.taxableServiceTurnoverMinor);
  const threshold = NORWAY_MVA_REGISTRATION_THRESHOLD_MINOR;
  const alertAt = (threshold * BigInt(NORWAY_MVA_OWNER_ALERT_RATIO_BPS)) / BigInt(10000);
  const remaining = turnover >= threshold ? BigInt(0) : threshold - turnover;
  const percentOfThresholdBps =
    threshold === BigInt(0) ? 0 : Number((turnover * BigInt(10000)) / threshold);
  const mvaRegistered = input.mvaRegistered === true;
  return {
    taxableServiceTurnoverMinor: turnover,
    thresholdMinor: threshold,
    alertAtMinor: alertAt,
    remainingMinor: remaining,
    percentOfThresholdBps,
    alert: turnover >= alertAt && !mvaRegistered,
    crossed: turnover >= threshold && !mvaRegistered,
    LUNCHPORTALEN_MVA_REGISTERED: mvaRegistered,
    PLATFORM_REAL_MVA_INVOICING: mvaRegistered ? "ELIGIBLE" : "BLOCKED",
    ownerActionPath: "docs/rc/phase16no/evidence/mva/OWNER_MVA_REGISTRATION_ACTION.md",
  };
}
