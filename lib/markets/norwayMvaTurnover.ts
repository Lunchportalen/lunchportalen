/**
 * Phase 16NO.1 — track Lunchportalen AS taxable platform-service turnover
 * (commission net excl. MVA), not catering providers' food sales.
 *
 * Skatteetaten registration threshold for ordinary businesses: NOK 50 000
 * (ex VAT) over a 12-month period — owner must register when obligation arises.
 */

export const NORWAY_MVA_REGISTRATION_THRESHOLD_MINOR = 5_000_000n; // NOK 50_000.00
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
  const alertAt = (threshold * BigInt(NORWAY_MVA_OWNER_ALERT_RATIO_BPS)) / 10000n;
  const remaining = turnover >= threshold ? 0n : threshold - turnover;
  const percentOfThresholdBps =
    threshold === 0n ? 0 : Number((turnover * 10000n) / threshold);
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
