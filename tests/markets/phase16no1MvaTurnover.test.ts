import { describe, expect, it } from "vitest";
import {
  evaluateNorwayMvaTurnover,
  NORWAY_MVA_REGISTRATION_THRESHOLD_MINOR,
} from "@/lib/markets/norwayMvaTurnover";

describe("Phase 16NO.1 — Norway MVA turnover gate", () => {
  it("tracks platform commission net, alerts at 80%, blocks real invoicing until registered", () => {
    const mid = evaluateNorwayMvaTurnover({
      taxableServiceTurnoverMinor: 4_000_000n, // NOK 40_000
      mvaRegistered: false,
    });
    expect(mid.thresholdMinor).toBe(NORWAY_MVA_REGISTRATION_THRESHOLD_MINOR);
    expect(mid.alert).toBe(true);
    expect(mid.crossed).toBe(false);
    expect(mid.PLATFORM_REAL_MVA_INVOICING).toBe("BLOCKED");

    const over = evaluateNorwayMvaTurnover({
      taxableServiceTurnoverMinor: 5_000_000n,
      mvaRegistered: false,
    });
    expect(over.crossed).toBe(true);
    expect(over.remainingMinor).toBe(0n);

    const registered = evaluateNorwayMvaTurnover({
      taxableServiceTurnoverMinor: 6_000_000n,
      mvaRegistered: true,
    });
    expect(registered.PLATFORM_REAL_MVA_INVOICING).toBe("ELIGIBLE");
    expect(registered.alert).toBe(false);
    expect(registered.crossed).toBe(false);
  });
});
