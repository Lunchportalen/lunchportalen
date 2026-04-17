import { describe, expect, it } from "vitest";

import { groupByProduct, type SalesPoint } from "@/lib/forecast/data";
import { forecastUnits } from "@/lib/forecast/forecast";
import { safetyStock } from "@/lib/forecast/inventory";
import { suggestPurchase, suggestPurchaseCapped } from "@/lib/forecast/purchase";
import { trend, weekdayIndex, weekdayLift } from "@/lib/forecast/trends";
import { buildDemandMenuPlanFromPoints } from "@/lib/forecast/controlTowerPlan";
import { buildMenu } from "@/lib/menu/optimizer";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";

describe("forecast data", () => {
  it("groupByProduct", () => {
    const pts: SalesPoint[] = [
      { date: "2025-01-01", productId: "a", units: 1 },
      { date: "2025-01-02", productId: "a", units: 2 },
      { date: "2025-01-01", productId: "b", units: 3 },
    ];
    const m = groupByProduct(pts);
    expect(m.get("a")?.length).toBe(2);
    expect(m.get("b")?.length).toBe(1);
  });
});

describe("forecastUnits", () => {
  it("glidende snitt siste 7", () => {
    const pts: SalesPoint[] = Array.from({ length: 10 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, "0")}`,
      productId: "p",
      units: 10,
    }));
    const f = forecastUnits(pts, 7);
    expect(f.forecastPerDay).toBe(10);
    expect(f.confidence).toBe(0.7);
  });

  it("lav konfidens ved få punkter", () => {
    const pts: SalesPoint[] = [
      { date: "2025-01-01", productId: "p", units: 4 },
      { date: "2025-01-02", productId: "p", units: 6 },
    ];
    const f = forecastUnits(pts, 7);
    expect(f.confidence).toBe(0.4);
  });
});

describe("trends", () => {
  it("trend opp", () => {
    const pts: SalesPoint[] = [
      { date: "2025-01-01", productId: "p", units: 10 },
      { date: "2025-01-02", productId: "p", units: 10 },
      { date: "2025-01-03", productId: "p", units: 10 },
      { date: "2025-01-04", productId: "p", units: 20 },
      { date: "2025-01-05", productId: "p", units: 20 },
      { date: "2025-01-06", productId: "p", units: 20 },
    ];
    const t = trend(pts);
    expect(t.dir).toBe("up");
  });

  it("weekdayIndex", () => {
    expect(typeof weekdayIndex("2025-06-15")).toBe("number");
  });

  it("weekdayLift", () => {
    const pts: SalesPoint[] = [
      { date: "2025-06-09", productId: "p", units: 10 },
      { date: "2025-06-16", productId: "p", units: 20 },
    ];
    const lift = weekdayLift(pts);
    expect(lift.size).toBeGreaterThan(0);
  });
});

describe("inventory & purchase", () => {
  it("safetyStock", () => {
    expect(safetyStock(10, 2, 1.3)).toBe(26);
  });

  it("suggestPurchase aldri negativ", () => {
    const r = suggestPurchase({
      forecastPerDay: 5,
      horizonDays: 7,
      stock: { onHand: 1000, leadDays: 1 },
    });
    expect(r.suggestedUnits).toBeGreaterThanOrEqual(0);
  });

  it("suggestPurchaseCapped demper ved lav konfidens", () => {
    const raw = suggestPurchase({
      forecastPerDay: 10,
      horizonDays: 7,
      stock: { onHand: 0, leadDays: 1, wasteFactor: 0.1 },
    });
    const capped = suggestPurchaseCapped({
      forecastPerDay: 10,
      horizonDays: 7,
      stock: { onHand: 0, leadDays: 1, wasteFactor: 0.1 },
      confidence: 0.4,
    });
    expect(capped.suggestedUnits).toBeLessThanOrEqual(raw.suggestedUnits);
  });
});

describe("menu optimizer", () => {
  it("buildMenu sorterer og begrenser", () => {
    const menu = buildMenu(
      [
        { productId: "a", forecast: 1, margin: 0.5, profitPerUnit: 10, stock: 10 },
        { productId: "b", forecast: 5, margin: 0.5, profitPerUnit: 10, stock: 10 },
      ],
      1,
    );
    expect(menu).toHaveLength(1);
    expect(menu[0].productId).toBe("b");
  });
});

describe("control tower plan", () => {
  it("bygger plan fra salgspunkter", () => {
    const catalog: SocialProductRef[] = [
      { id: "p1", name: "Test", url: "https://x", price: 100, cost: 40, stock: 10 },
    ];
    const pts: SalesPoint[] = Array.from({ length: 8 }, (_, i) => ({
      date: `2025-02-${String(i + 1).padStart(2, "0")}`,
      productId: "p1",
      units: 5,
    }));
    const plan = buildDemandMenuPlanFromPoints(pts, catalog);
    expect(plan.ok).toBe(true);
    expect(plan.products).toHaveLength(1);
    expect(plan.weeklyMenu.length).toBeGreaterThan(0);
  });

  it("fail-closed uten data", () => {
    const plan = buildDemandMenuPlanFromPoints([], []);
    expect(plan.ok).toBe(false);
  });
});
