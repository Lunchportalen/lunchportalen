import { describe, expect, it } from "vitest";

import { aggregateFinanceData } from "@/lib/finance/data";
import { calculatePL } from "@/lib/finance/pl";
import { unitEconomics } from "@/lib/finance/unit";
import { simulateDecision } from "@/lib/simulation/decisions";
import { simulateScenario } from "@/lib/simulation/engine";
import { assessRisk } from "@/lib/simulation/risk";

describe("calculatePL", () => {
  it("beregner brutto, netto og margin", () => {
    const pl = calculatePL({ revenue: 1000, costOfGoods: 400, adSpend: 100 });
    expect(pl.grossProfit).toBe(600);
    expect(pl.netProfit).toBe(500);
    expect(pl.margin).toBeCloseTo(0.5);
  });

  it("tolererer manglende felt som 0", () => {
    const pl = calculatePL({});
    expect(pl.revenue).toBe(0);
    expect(pl.margin).toBe(0);
  });
});

describe("aggregateFinanceData", () => {
  it("summerer omsetning, varekost og spend", () => {
    const out = aggregateFinanceData(
      [
        { total: 100, productId: "a" },
        { total: 50, productId: "b" },
      ],
      [{ spend: 30 }, { spend: 20 }],
      [
        { id: "a", cost: 40 },
        { id: "b", cost: 20 },
      ],
    );
    expect(out.revenue).toBe(150);
    expect(out.costOfGoods).toBe(60);
    expect(out.adSpend).toBe(50);
  });
});

describe("unitEconomics", () => {
  it("margin og DB/enhet", () => {
    const u = unitEconomics({ id: "x", price: 100, cost: 25 });
    expect(u.margin).toBeCloseTo(0.75);
    expect(u.profitPerUnit).toBe(75);
  });
});

describe("simulateScenario", () => {
  it("øker spend og omsetning ved budsjett-scenario", () => {
    const base = { revenue: 1000, costOfGoods: 400, adSpend: 100 };
    const s = simulateScenario(base, { increaseBudget: true });
    expect(s.revenue).toBeCloseTo(1150);
    expect(s.adSpend).toBeCloseTo(120);
    expect(s.pl.netProfit).toBe(s.revenue - s.costOfGoods - s.adSpend);
  });
});

describe("simulateDecision", () => {
  it("mapper beslutningstyper", () => {
    const ctx = { revenue: 2000, costOfGoods: 800, adSpend: 200 };
    const up = simulateDecision("increase_price", ctx);
    expect(up.revenue).toBeCloseTo(2100);
    const none = simulateDecision("unknown", ctx);
    expect(none.revenue).toBe(2000);
  });
});

describe("assessRisk", () => {
  it("klassifiserer etter nettoresultat", () => {
    expect(assessRisk({ profit: -1 })).toBe("high");
    expect(assessRisk({ profit: 500 })).toBe("medium");
    expect(assessRisk({ profit: 2000 })).toBe("low");
  });
});
