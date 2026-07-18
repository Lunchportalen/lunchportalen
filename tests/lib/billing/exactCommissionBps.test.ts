import { describe, expect, it } from "vitest";

import {
  COMMISSION_RATE_BPS,
  buildCommissionEvent,
  commissionExactNumerator,
  periodSettlement,
  reversalNumerator,
} from "@/lib/billing/exactCommissionBps";

describe("exactCommissionBps", () => {
  it("uses 500 bps exact integer numerator", () => {
    expect(COMMISSION_RATE_BPS).toBe(500);
    expect(commissionExactNumerator(19900)).toBe(19900 * 500);
    expect(() => commissionExactNumerator(19.9)).toThrow(/FLOATING_POINT/);
  });

  it("preserves remainder carry across period settlement", () => {
    // 3 * 333 = 999 numerators from small nets; invoice floors with carry
    const a = commissionExactNumerator(1); // 500
    const b = commissionExactNumerator(1); // 500
    const s1 = periodSettlement({ carryIn: 0, earnedNumerators: [a, b], reversalNumerators: [] });
    expect(s1.commissionInvoiceMinor).toBe(0);
    expect(s1.carryOut).toBe(1000);
    const s2 = periodSettlement({
      carryIn: s1.carryOut,
      earnedNumerators: [commissionExactNumerator(18)], // 9000
      reversalNumerators: [],
    });
    expect(s2.periodNumerator).toBe(10000);
    expect(s2.commissionInvoiceMinor).toBe(1);
    expect(s2.carryOut).toBe(0);
  });

  it("reverses exact original numerator", () => {
    const ev = buildCommissionEvent({
      commissionable_net_minor: 13000,
      currency: "NOK",
      provider_id: "p1",
      company_id: "c1",
      package_key: "BASIS",
      price_version: "v1",
      order_id: "o1",
      recognition_timestamp: "2026-07-18T00:00:00Z",
      source_event: "delivered",
      reversal_of: null,
    });
    expect(reversalNumerator(ev.exact_numerator)).toBe(ev.exact_numerator);
  });
});
