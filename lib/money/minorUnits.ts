/**
 * Currency-safe money helpers (integer minor units only).
 * Never use float for commercial amounts.
 * Currency codes come from the canonical market registry — never inferred from language.
 */

import { SUPPORTED_MARKETS } from "@/lib/markets/supportedMarkets";

export type RoundingMode = "half_up" | "half_even" | "down" | "up";

/** ISO-4217 currencies used by the 21 launch markets (derived, not hard-listed). */
export const LAUNCH_CURRENCY_CODES: readonly string[] = Array.from(
  new Set(SUPPORTED_MARKETS.map((m) => m.currency)),
).sort();

/** Minor units for launch currencies (ISO-4217). All current launch currencies use 2. */
const DEFAULT_MINOR_UNITS = 2;

export function minorUnitsFor(currencyCode: string): number {
  const code = currencyCode.trim().toUpperCase();
  if (!LAUNCH_CURRENCY_CODES.includes(code)) {
    throw new Error(`CURRENCY_UNSUPPORTED:${code}`);
  }
  return DEFAULT_MINOR_UNITS;
}

export type MoneyMinor = {
  currencyCode: string;
  amountMinor: bigint;
};

export function assertSameCurrency(a: string, b: string): void {
  if (a.trim().toUpperCase() !== b.trim().toUpperCase()) {
    throw new Error(`CROSS_CURRENCY_FORBIDDEN:${a}/${b}`);
  }
}

export function addMinor(a: MoneyMinor, b: MoneyMinor): MoneyMinor {
  assertSameCurrency(a.currencyCode, b.currencyCode);
  return { currencyCode: a.currencyCode, amountMinor: a.amountMinor + b.amountMinor };
}

export function negateMinor(m: MoneyMinor): MoneyMinor {
  return { currencyCode: m.currencyCode, amountMinor: -m.amountMinor };
}

/** Apply bps to a minor amount with half-up rounding (default commercial). */
export function applyBps(amountMinor: bigint, bps: number, mode: RoundingMode = "half_up"): bigint {
  if (!Number.isInteger(bps) || bps < 0) {
    throw new Error(`BPS_INVALID:${bps}`);
  }
  const scaled = amountMinor * BigInt(bps);
  const denom = BigInt(10_000);
  const zero = BigInt(0);
  const one = BigInt(1);
  if (mode === "down") return scaled / denom;
  if (mode === "up") {
    const q = scaled / denom;
    return scaled % denom === zero ? q : q + (scaled > zero ? one : -one);
  }
  const half = denom / BigInt(2);
  if (scaled >= zero) return (scaled + half) / denom;
  return (scaled - half) / denom;
}

export function taxOnExclusiveBase(baseMinor: bigint, rateBps: number): bigint {
  return applyBps(baseMinor, rateBps, "half_up");
}

/** Platform commission — always 500 bps (5%). */
export function platformCommissionMinor(portionTotalMinor: bigint, currencyCode: string): MoneyMinor {
  minorUnitsFor(currencyCode);
  return {
    currencyCode: currencyCode.toUpperCase(),
    amountMinor: applyBps(portionTotalMinor, 500, "half_up"),
  };
}
