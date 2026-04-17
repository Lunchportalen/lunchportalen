import { describe, expect, it } from "vitest";

import { estimateElasticity } from "@/lib/pricing/elasticity";
import { suggestDynamicPrice } from "@/lib/pricing/engine";
import { validatePriceChange } from "@/lib/pricing/guard";
import { ensureMargin } from "@/lib/pricing/margin";
import { suggestSupplierNegotiation } from "@/lib/procurement/negotiation";
import type { Supplier } from "@/lib/procurement/suppliers";
import { suggestRetailPriceWithGuards } from "@/lib/pricing/safeRetail";

describe("pricing strategy — guard", () => {
  it("avviser hopp over +15 %", () => {
    expect(validatePriceChange(100, 116)).toBe(false);
    expect(validatePriceChange(100, 115)).toBe(true);
  });

  it("avviser fall under −20 %", () => {
    expect(validatePriceChange(100, 79)).toBe(false);
    expect(validatePriceChange(100, 80)).toBe(true);
  });

  it("fail-closed ved ugyldig gammel pris", () => {
    expect(validatePriceChange(0, 100)).toBe(false);
  });
});

describe("pricing strategy — margin", () => {
  it("beholder gammel pris hvis ny gir margin under 25 %", () => {
    const out = ensureMargin({ price: 100, cost: 80 }, 90);
    expect(out).toBe(100);
  });

  it("tillater ny pris når margin ≥ 25 %", () => {
    expect(ensureMargin({ price: 100, cost: 50 }, 100)).toBe(100);
    expect(ensureMargin({ price: 100, cost: 50 }, 90)).toBe(90);
  });

  it("bruker høyeste av kost og innkjøpspris", () => {
    const out = ensureMargin({ price: 100, cost: 40, procurementUnitCost: 80 }, 104);
    expect(out).toBe(100);
  });
});

describe("pricing strategy — elasticity", () => {
  it("klassifiserer etter demandScore", () => {
    expect(estimateElasticity({ demandScore: 0.8 })).toBe("low");
    expect(estimateElasticity({ demandScore: 0.2 })).toBe("high");
    expect(estimateElasticity({ demandScore: 0.5 })).toBe("medium");
    expect(estimateElasticity({})).toBe("medium");
  });
});

describe("pricing strategy — dynamic engine", () => {
  it("øker pris når margin lav og etterspørsel høy", () => {
    const raw = suggestDynamicPrice({ price: 100, cost: 85, demandScore: 0.9 });
    expect(raw).toBeGreaterThan(100);
  });
});

describe("pricing strategy — safe retail orchestration", () => {
  it("holder seg innenfor vakter og margin", () => {
    const r = suggestRetailPriceWithGuards({
      price: 100,
      cost: 50,
      demandScore: 0.75,
    });
    expect(r.suggestedPrice).toBeGreaterThan(0);
    expect(r.marginAfter).toBeGreaterThanOrEqual(0.25 - 1e-9);
    if (r.suggestedPrice !== r.currentPrice) {
      expect(validatePriceChange(r.currentPrice, r.suggestedPrice)).toBe(true);
    }
  });

  it("reagerer på høyere innkjøpskost", () => {
    const lowCost = suggestRetailPriceWithGuards({ price: 100, cost: 40, demandScore: 0.5 });
    const highProc = suggestRetailPriceWithGuards({
      price: 100,
      cost: 40,
      demandScore: 0.5,
      procurementUnitCost: 75,
    });
    expect(highProc.marginBefore).toBeLessThan(lowCost.marginBefore);
  });
});

describe("procurement — negotiation signals", () => {
  const s: Supplier = {
    id: "a",
    name: "A",
    pricePerUnit: 12,
    deliveryDays: 1,
    minOrderQty: 1,
    reliabilityScore: 0.9,
  };

  it("foreslår nedforhandling når over peer-median", () => {
    const n = suggestSupplierNegotiation(s, 10);
    expect(n.action).toBe("negotiate_down");
    if (n.action === "negotiate_down") expect(n.targetPrice).toBe(10);
  });

  it("ok når konkurransedyktig", () => {
    const n = suggestSupplierNegotiation({ ...s, pricePerUnit: 9 }, 10);
    expect(n.action).toBe("ok");
  });

  it("ingen forslag uten markedsreferanse", () => {
    const n = suggestSupplierNegotiation(s, 0);
    expect(n.action).toBe("ok");
    expect(n.message).toMatch(/Mangler markedsreferanse/i);
  });
});
