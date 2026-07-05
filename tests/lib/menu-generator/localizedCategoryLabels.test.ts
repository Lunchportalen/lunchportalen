import { describe, expect, test } from "vitest";

import {
  buildLocalizedCatalogOverlay,
  buildLocalizedRuntimeCategoryLabels,
  getLocalizedCategoryLabel,
  getLocalizedCategoryLabels,
} from "@/lib/menu-generator";
import { getFixedDishesByCategory } from "@/lib/menu-generator/localizedFixedDishBanks";

describe("localizedCategoryLabels", () => {
  test("de-DE labels never show Norwegian Påsmurt or Salatboks", () => {
    const labels = getLocalizedCategoryLabels("de-DE");
    const values = Object.values(labels).join(" ");
    expect(values).not.toContain("Påsmurt");
    expect(values).not.toContain("Salatboks");
    expect(labels.sandwich).toBe("Belegte Brötchen");
    expect(labels.salad).toBe("Salate");
    expect(labels.hotMeal).toBe("Warme Gerichte");
    expect(labels.asian).toBe("Asiatisch");
  });

  test("sv-SE shows Mackor and Sallader", () => {
    const labels = getLocalizedCategoryLabels("sv-SE");
    expect(labels.sandwich).toBe("Mackor");
    expect(labels.salad).toBe("Sallader");
  });

  test("da-DK shows Smørrebrød and Salater", () => {
    const labels = getLocalizedCategoryLabels("da-DK");
    expect(labels.sandwich).toBe("Smørrebrød");
    expect(labels.salad).toBe("Salater");
  });

  test("en-GB shows Sandwiches and Salads", () => {
    const labels = getLocalizedCategoryLabels("en-GB");
    expect(labels.sandwich).toBe("Sandwiches");
    expect(labels.salad).toBe("Salads");
  });

  test("nb-NO can show Påsmurt and Salatboks", () => {
    const labels = getLocalizedCategoryLabels("nb-NO");
    expect(labels.sandwich).toBe("Påsmurt");
    expect(labels.salad).toBe("Salatboks");
  });

  test("buildLocalizedRuntimeCategoryLabels maps runtime categories from menuLocale", () => {
    const de = buildLocalizedRuntimeCategoryLabels("de-DE");
    expect(de.paasmurt).toBe("Belegte Brötchen");
    expect(de.salat).toBe("Salate");
    expect(de.varmrett).toBe("Warme Gerichte");
    expect(de.thai).toBe("Asiatisch");

    const no = buildLocalizedRuntimeCategoryLabels("nb-NO");
    expect(no.paasmurt).toBe("Påsmurt");
    expect(no.salat).toBe("Salatboks");
  });

  test("provider menuLocale controls labels — employee UI locale is not used here", () => {
    const providerDe = buildLocalizedRuntimeCategoryLabels("de-DE");
    const providerNo = buildLocalizedRuntimeCategoryLabels("nb-NO");
    expect(providerDe.paasmurt).not.toBe(providerNo.paasmurt);
    expect(getLocalizedCategoryLabel("de-DE", "sandwich")).toBe("Belegte Brötchen");
  });

  test("de-DE catalog overlay uses German dish bank — no Ost & Skinke or Kylling karri", () => {
    const overlay = buildLocalizedCatalogOverlay("de-DE");
    const paasmurt = overlay.rows.find((r) => r.key === "paasmurt");
    const titles = (paasmurt?.items ?? []).map((i) => i.title).join(" ");
    expect(titles).not.toContain("Ost & Skinke");
    expect(titles).not.toContain("Kylling karri");
    expect(titles).toContain("Belegtes Brötchen mit Schinken");

    const hotMealDishes = getFixedDishesByCategory("de-DE", "hotMeal");
    expect(hotMealDishes.some((d) => d.title.includes("Schnitzel"))).toBe(true);
    expect(hotMealDishes.some((d) => d.title.includes("Bratwurst"))).toBe(true);
  });

  test("de-DE overlay category titles are localized", () => {
    const overlay = buildLocalizedCatalogOverlay("de-DE");
    const titles = overlay.rows.map((r) => String(r.title ?? ""));
    expect(titles).toContain("Belegte Brötchen");
    expect(titles).toContain("Salate");
    expect(titles).not.toContain("Påsmurt");
    expect(titles).not.toContain("Salatboks");
  });
});
