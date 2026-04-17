import { describe, expect, it, beforeEach } from "vitest";

import {
  detectHighSpendLowReturn,
  detectNoRevenue,
  detectProfitDrop,
  detectRevenueDayDropProxy,
  detectSuddenSpike,
  detectWinner,
} from "@/lib/alerts/detectors";
import { runAlertChecks } from "@/lib/alerts/engine";
import { applyCooldownGate, clearFinancialAlertCooldownForTests, shouldSend } from "@/lib/alerts/guard";

describe("financial alert detectors", () => {
  it("detectProfitDrop ved >30 % fall", () => {
    expect(detectProfitDrop(60, 100)?.type).toBe("profit_drop");
    expect(detectProfitDrop(71, 100)).toBeNull();
  });

  it("detectNoRevenue kun etter 14 og ved 0", () => {
    expect(detectNoRevenue({ revenueToday: 0, osloHour: 10 })).toBeNull();
    expect(detectNoRevenue({ revenueToday: 0, osloHour: 15 })?.type).toBe("no_revenue");
  });

  it("detectHighSpendLowReturn", () => {
    expect(detectHighSpendLowReturn(600, 400)?.type).toBe("high_spend_low_return");
    expect(detectHighSpendLowReturn(400, 400)).toBeNull();
  });

  it("detectWinner", () => {
    expect(detectWinner(0.5)?.type).toBe("winner_detected");
    expect(detectWinner(0.2)).toBeNull();
  });

  it("detectSuddenSpike", () => {
    expect(detectSuddenSpike(200, 100)?.type).toBe("sudden_spike");
  });

  it("detectRevenueDayDropProxy", () => {
    expect(detectRevenueDayDropProxy(50, 100)?.type).toBe("profit_drop");
  });
});

describe("runAlertChecks", () => {
  it("returnerer tomt når data ikke er pålitelig", () => {
    const out = runAlertChecks({
      dataTrusted: false,
      revenueToday: 0,
      revenueYesterday: 100,
      profitToday: null,
      profitYesterday: null,
      adSpend: 0,
      adSpendKnown: true,
      osloHour: 15,
      ordersCountedToday: 0,
      roasCurrent: null,
      roasPrevious: null,
    });
    expect(out).toEqual([]);
  });
});

describe("cooldown gate", () => {
  beforeEach(() => {
    clearFinancialAlertCooldownForTests();
  });

  it("undertrykker samme type innen vindu", () => {
    const a = {
      id: "1",
      type: "no_revenue" as const,
      message: "x",
      severity: "high" as const,
      timestamp: Date.now(),
    };
    expect(shouldSend(a)).toBe(true);
    expect(shouldSend({ ...a, id: "2", timestamp: Date.now() })).toBe(false);
    const batch = applyCooldownGate([
      { ...a, id: "3", type: "winner_detected", severity: "low", message: "w", timestamp: 1 },
    ]);
    expect(batch.sent).toHaveLength(1);
  });
});
