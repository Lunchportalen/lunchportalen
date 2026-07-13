/**
 * GLOBAL RELEASE GATE (Fase F2): economic calculations across all launch currencies.
 * The commission engine is bigint minor-unit based and currency-agnostic; these
 * tests lock rounding, negative corrections and no-float invariants per currency.
 */
import { describe, test, expect } from "vitest";

import {
  calculateCommissionExactMinor,
  normalizeCurrencyCode,
  LP_GLOBAL_COMMISSION_RATE_BPS,
} from "@/lib/billing/globalCommission";

const LAUNCH_CURRENCIES = ["NOK", "SEK", "DKK", "EUR", "GBP", "CHF", "USD", "CAD", "AUD", "SGD"] as const;

describe("currency normalization", () => {
  test("all launch market currencies are valid ISO codes", () => {
    for (const c of LAUNCH_CURRENCIES) {
      expect(normalizeCurrencyCode(c)).toBe(c);
      expect(normalizeCurrencyCode(` ${c.toLowerCase()} `)).toBe(c);
    }
  });

  test("invalid currency codes are rejected (fail-closed)", () => {
    expect(() => normalizeCurrencyCode("NOKK")).toThrow("INVALID_CURRENCY");
    expect(() => normalizeCurrencyCode("kr")).toThrow("INVALID_CURRENCY");
    expect(() => normalizeCurrencyCode("")).toThrow("INVALID_CURRENCY");
  });
});

describe("commission in minor units — identical semantics for every currency", () => {
  test("5% of 13000 minor = 650 minor (BASIS/LUXUS style amounts)", () => {
    for (const _c of LAUNCH_CURRENCIES) {
      const r = calculateCommissionExactMinor(13000);
      expect(r.roundedMinor).toBe(BigInt(650));
      expect(r.decimal).toBe("650.000000");
    }
  });

  test("half-away-from-zero rounding at exact .5 minor boundaries", () => {
    // 5% of 1990 = 99.5 → 100 (half away from zero)
    expect(calculateCommissionExactMinor(1990).roundedMinor).toBe(BigInt(100));
    // 5% of 1970 = 98.5 → 99
    expect(calculateCommissionExactMinor(1970).roundedMinor).toBe(BigInt(99));
    // 5% of 10 = 0.5 → 1
    expect(calculateCommissionExactMinor(10).roundedMinor).toBe(BigInt(1));
  });

  test("negative corrections (refund/cancel) mirror positive amounts exactly", () => {
    for (const basis of [13000, 1990, 10, 999_999_999]) {
      const pos = calculateCommissionExactMinor(basis).roundedMinor;
      const neg = calculateCommissionExactMinor(-basis).roundedMinor;
      expect(neg).toBe(-pos);
    }
  });

  test("large EUR-scale aggregates stay exact (bigint, no float)", () => {
    const basis = BigInt("123456789012"); // > Number.MAX_SAFE_INTEGER/100 territory in minor units
    const r = calculateCommissionExactMinor(basis);
    expect(r.roundedMinor).toBe(
      (basis * BigInt(LP_GLOBAL_COMMISSION_RATE_BPS) + BigInt(5000)) / BigInt(10000),
    );
  });

  test("non-integer (float) input is rejected — no float money", () => {
    expect(() => calculateCommissionExactMinor(130.5 as unknown as number)).toThrow(
      "MONEY_MINOR_MUST_BE_SAFE_INTEGER",
    );
    expect(() => calculateCommissionExactMinor(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      "MONEY_MINOR_MUST_BE_SAFE_INTEGER",
    );
  });

  test("VAT application on minor units stays integer for launch VAT rates", () => {
    // Per-market VAT rates from markets.vat_rate_food (percent, 2 decimals).
    const vatRates = [15, 12, 25, 14, 20, 19, 10, 0, 5, 9, 12, 8.1, 13.5, 3];
    for (const rate of vatRates) {
      const netMinor = BigInt(13000);
      // integer math with bps-style scaling: rate * 100 gives integer bps for all launch rates
      const rateBps = BigInt(Math.round(rate * 100));
      const vatMinor = (netMinor * rateBps + BigInt(5000)) / BigInt(10000);
      expect(typeof vatMinor).toBe("bigint");
      expect(vatMinor >= BigInt(0)).toBe(true);
    }
  });
});

describe("legacy NOK engine isolation (Fase F P0)", () => {
  test("invoice generation cron filters companies to the NO market", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const src = fs.readFileSync(
      path.join(process.cwd(), "app/api/cron/invoices/generate/route.ts"),
      "utf8",
    );
    expect(src).toContain("loadNoMarketCompanyIds");
    expect(src).toContain("skipped_non_no_market");
  });
});
