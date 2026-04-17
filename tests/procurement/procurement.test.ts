import { describe, expect, it } from "vitest";

import { suggestProcurement } from "@/lib/procurement/engine";
import { validateProcurement, PROCUREMENT_MAX_ESTIMATED_COST_NOK } from "@/lib/procurement/guard";
import { requireProcurementApproval } from "@/lib/procurement/approval";
import { calculateOrderQty } from "@/lib/procurement/quantity";
import { pickBestSupplier, rankSuppliers, scoreSupplier } from "@/lib/procurement/scoring";
import type { Supplier } from "@/lib/procurement/suppliers";
import { demoSuppliersForProduct } from "@/lib/procurement/demoSuppliers";
import { buildProcurementPlan } from "@/lib/procurement/plan";
import { buildDemandMenuPlanFromPoints } from "@/lib/forecast/controlTowerPlan";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";

const suppliers: Supplier[] = [
  { id: "a", name: "Cheap slow", pricePerUnit: 30, deliveryDays: 7, reliabilityScore: 0.7 },
  { id: "b", name: "Mid", pricePerUnit: 40, deliveryDays: 3, reliabilityScore: 0.85 },
  { id: "c", name: "Fast expensive", pricePerUnit: 55, deliveryDays: 1, reliabilityScore: 0.95 },
];

describe("procurement scoring", () => {
  it("scoreSupplier er deterministisk og positiv for gyldig leverandør", () => {
    expect(scoreSupplier(suppliers[0])).toBeGreaterThan(0);
  });

  it("pickBestSupplier velger rangert første", () => {
    const best = pickBestSupplier(suppliers);
    expect(best).toBeDefined();
    const ranked = rankSuppliers(suppliers);
    expect(best?.id).toBe(ranked[0].id);
  });

  it("tom liste → undefined", () => {
    expect(pickBestSupplier([])).toBeUndefined();
  });
});

describe("calculateOrderQty", () => {
  it("aldri negativ", () => {
    expect(calculateOrderQty(10, 7, 1000)).toBe(0);
    expect(calculateOrderQty(0, 7, 0)).toBe(0);
  });

  it("buffer 1.2", () => {
    expect(calculateOrderQty(10, 1, 0)).toBe(Math.ceil(12));
  });
});

describe("validateProcurement", () => {
  it("blokkerer høy kost", () => {
    expect(
      validateProcurement({
        suggestedQty: 100,
        estimatedCost: PROCUREMENT_MAX_ESTIMATED_COST_NOK + 1,
      }),
    ).toBe(false);
  });

  it("blokkerer qty 0", () => {
    expect(validateProcurement({ suggestedQty: 0, estimatedCost: 100 })).toBe(false);
  });
});

describe("requireProcurementApproval", () => {
  it("aldri auto-godkjent", () => {
    const r = requireProcurementApproval({ x: 1 });
    expect(r.approved).toBe(false);
    expect(r.reason).toContain("Manual");
  });
});

describe("suggestProcurement", () => {
  it("null uten leverandører", () => {
    expect(suggestProcurement({ id: "p", stock: 5 }, [], { forecastPerDay: 2, horizonDays: 7 })).toBeNull();
  });

  it("minOrderQty hever mengde", () => {
    const sups: Supplier[] = [
      { id: "m", name: "M", pricePerUnit: 10, deliveryDays: 2, reliabilityScore: 0.9, minOrderQty: 50 },
    ];
    const r = suggestProcurement({ id: "p", stock: 0 }, sups, { forecastPerDay: 1, horizonDays: 1 });
    expect(r?.suggestedQty).toBe(50);
  });
});

describe("buildProcurementPlan integration", () => {
  it("kobler menyplan og demo-leverandører", () => {
    const catalog: SocialProductRef[] = [
      { id: "lp-b2b-core", name: "Core", url: "https://x", price: 100, cost: 40, stock: 10 },
    ];
    const pts = Array.from({ length: 8 }, (_, i) => ({
      date: `2025-03-${String(i + 1).padStart(2, "0")}`,
      productId: "lp-b2b-core",
      units: 4,
    }));
    const menu = buildDemandMenuPlanFromPoints(pts, catalog);
    expect(menu.ok).toBe(true);
    const plan = buildProcurementPlan(menu, catalog, demoSuppliersForProduct);
    expect(plan.ok).toBe(true);
    expect(plan.rows.length).toBeGreaterThan(0);
    const line = plan.rows.find((r) => r.productId === "lp-b2b-core");
    expect(line?.suggestion).not.toBeNull();
    expect(demoSuppliersForProduct("lp-b2b-core").length).toBeGreaterThan(1);
  });
});
