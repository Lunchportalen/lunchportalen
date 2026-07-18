/**
 * PHASE 17MENU.1 — Exact 5% commission (500 bps) with integer remainder carry.
 * Never use floating-point for financial commission math.
 */

export const COMMISSION_RATE_BPS = 500 as const;
export const COMMISSION_DENOMINATOR = 10_000 as const;
export const COMMERCIAL_MODEL_ID = "agency_commission_invoice_only_v1" as const;

export type CommissionEventExact = {
  commissionable_net_minor: number;
  commission_rate_bps: typeof COMMISSION_RATE_BPS;
  exact_numerator: number;
  denominator: typeof COMMISSION_DENOMINATOR;
  currency: string;
  provider_id: string;
  company_id: string;
  package_key: string;
  price_version: string;
  order_id: string;
  recognition_timestamp: string;
  source_event: string;
  reversal_of: string | null;
  calculation_checksum: string;
};

export function assertIntegerMinor(n: number, label: string): number {
  if (!Number.isInteger(n) || !Number.isSafeInteger(n)) {
    throw new Error(`FLOATING_POINT_FINANCIAL_USAGE:${label}`);
  }
  if (n < 0) throw new Error(`NEGATIVE_MINOR:${label}`);
  return n;
}

/** exact_numerator = commissionable_net_minor * 500 */
export function commissionExactNumerator(commissionableNetMinor: number): number {
  const net = assertIntegerMinor(commissionableNetMinor, "commissionable_net_minor");
  return net * COMMISSION_RATE_BPS;
}

export function periodSettlement(args: {
  carryIn: number;
  earnedNumerators: readonly number[];
  reversalNumerators: readonly number[];
}): { periodNumerator: number; commissionInvoiceMinor: number; carryOut: number } {
  const carryIn = assertIntegerMinor(args.carryIn, "carry_in");
  let earned = 0;
  for (const n of args.earnedNumerators) earned += assertIntegerMinor(n, "earned");
  let reversed = 0;
  for (const n of args.reversalNumerators) reversed += assertIntegerMinor(n, "reversal");
  const periodNumerator = carryIn + earned - reversed;
  if (periodNumerator < 0) throw new Error("COMMISSION_IMBALANCE:negative_period");
  const commissionInvoiceMinor = Math.trunc(periodNumerator / COMMISSION_DENOMINATOR);
  const carryOut = periodNumerator % COMMISSION_DENOMINATOR;
  return { periodNumerator, commissionInvoiceMinor, carryOut };
}

/** Refunds reverse the exact original numerator (symmetric). */
export function reversalNumerator(originalExactNumerator: number): number {
  return assertIntegerMinor(originalExactNumerator, "original_exact_numerator");
}

export function checksumCommissionEvent(parts: {
  commissionable_net_minor: number;
  exact_numerator: number;
  currency: string;
  order_id: string;
  price_version: string;
}): string {
  const payload = [
    parts.commissionable_net_minor,
    COMMISSION_RATE_BPS,
    parts.exact_numerator,
    COMMISSION_DENOMINATOR,
    parts.currency,
    parts.order_id,
    parts.price_version,
  ].join("|");
  // Deterministic non-crypto fingerprint for audit equality (not a secret).
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `fnv1a_${(h >>> 0).toString(16)}`;
}

export function buildCommissionEvent(input: Omit<CommissionEventExact, "commission_rate_bps" | "denominator" | "exact_numerator" | "calculation_checksum"> & {
  exact_numerator?: number;
}): CommissionEventExact {
  const exact_numerator =
    input.exact_numerator ?? commissionExactNumerator(input.commissionable_net_minor);
  return {
    ...input,
    commission_rate_bps: COMMISSION_RATE_BPS,
    denominator: COMMISSION_DENOMINATOR,
    exact_numerator,
    calculation_checksum: checksumCommissionEvent({
      commissionable_net_minor: input.commissionable_net_minor,
      exact_numerator,
      currency: input.currency,
      order_id: input.order_id,
      price_version: input.price_version,
    }),
  };
}
