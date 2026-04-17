import { describe, expect, it } from "vitest";

import { evaluateAdCampaignEconomicsGate } from "@/lib/product/adCampaignEconomicsGate";
import { calculateMargin, calculateProfitPerUnit } from "@/lib/product/economics";
import { filterUnsafeProducts } from "@/lib/product/filter";
import {
  buildProductPricingSuggestionRows,
  buildProductPrioritizationRows,
} from "@/lib/product/growthProductViews";
import { inventorySignal } from "@/lib/product/inventory";
import { pickBestProducts } from "@/lib/product/prioritization";
import { suggestPrice } from "@/lib/product/pricing";
import { socialRefToProductEconomics } from "@/lib/product/socialRefEconomics";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import { pickBestProductForGrowth } from "@/lib/social/selection";

const hi: SocialProductRef = {
  id: "hi",
  name: "High margin",
  url: "https://x.test",
  price: 100,
  cost: 30,
  stock: 20,
};

const loMargin: SocialProductRef = {
  id: "lo",
  name: "Low margin",
  url: "https://x.test",
  price: 100,
  cost: 90,
  stock: 20,
};

const out: SocialProductRef = {
  id: "out",
  name: "Out of stock",
  url: "https://x.test",
  price: 100,
  cost: 40,
  stock: 0,
};

describe("product economics", () => {
  it("margin og profit per enhet", () => {
    const p = socialRefToProductEconomics(hi)!;
    expect(calculateMargin(p)).toBeCloseTo(0.7);
    expect(calculateProfitPerUnit(p)).toBe(70);
  });

  it("filterUnsafeProducts fjerner lav margin og tomt lager", () => {
    const list = [socialRefToProductEconomics(hi)!, socialRefToProductEconomics(loMargin)!, socialRefToProductEconomics(out)!];
    const safe = filterUnsafeProducts(list);
    expect(safe.map((x) => x.productId)).toEqual(["hi"]);
  });

  it("pickBestProducts rangerer høy margin først", () => {
    const a = socialRefToProductEconomics(hi)!;
    const mid: SocialProductRef = { ...hi, id: "mid", name: "Mid margin", cost: 50 };
    const b = socialRefToProductEconomics(mid)!;
    const ranked = pickBestProducts([b, a]);
    expect(ranked[0].productId).toBe("hi");
  });

  it("suggestPrice endrer ikke uten margin-utsving", () => {
    const p = socialRefToProductEconomics(hi)!;
    expect(suggestPrice(p)).toBe(100 * 0.95);
  });

  it("inventorySignal", () => {
    expect(inventorySignal(socialRefToProductEconomics(out)!)).toBe("out");
    expect(inventorySignal({ productId: "x", price: 1, cost: 0, stock: 3 })).toBe("low");
    expect(inventorySignal({ productId: "x", price: 1, cost: 0, stock: 60 })).toBe("high");
  });

  it("annonse-gate blokkerer lav margin", () => {
    const g = evaluateAdCampaignEconomicsGate(loMargin);
    expect(g.ok).toBe(false);
    if (g.ok === false) expect(g.reason).toBe("low_margin");
  });

  it("annonse-gate blokkerer tomt lager", () => {
    const g = evaluateAdCampaignEconomicsGate(out);
    expect(g.ok).toBe(false);
    if (g.ok === false) expect(g.reason).toBe("out_of_stock");
  });

  it("pickBestProductForGrowth velger trygg høy-margin", () => {
    const best = pickBestProductForGrowth([hi, loMargin, out], []);
    expect(best?.id).toBe("hi");
  });

  it("buildProductPrioritizationRows uten crash", () => {
    const rows = buildProductPrioritizationRows([hi, loMargin], []);
    expect(rows.length).toBe(2);
    expect(rows.some((r) => r.safeForPromotion)).toBe(true);
  });

  it("buildProductPricingSuggestionRows", () => {
    const rows = buildProductPricingSuggestionRows([hi]);
    expect(rows.length).toBe(1);
    expect(rows[0].suggestedPrice).toBeGreaterThan(0);
  });
});
