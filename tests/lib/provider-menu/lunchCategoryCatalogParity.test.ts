import { describe, expect, it } from "vitest";

import { staticMenuItemsByCategoryForPlanTier } from "@/lib/cms/lunchCategory";
import type { LunchCategorySanityRow } from "@/lib/cms/lunchCategory";
import {
  fixedVariantsFromCatalog,
  workspaceCategoriesFromCatalog,
} from "@/lib/provider-menu/lunchCategoryCatalog";
import {
  buildMenuCatalogVariants,
  catalogVariantsForTier,
} from "@/lib/provider-menu/providerMenuCatalogReadModel";
import { providerWorkspaceCategories, resolveVariantRowsForDay } from "@/lib/provider-menu/providerMenuCatalogSurface";
import { PROD_LUNCH_CATEGORY_FIXTURE } from "./lunchCategoryCatalogFixtures";

function fixtureAsSanityRows(): LunchCategorySanityRow[] {
  return PROD_LUNCH_CATEGORY_FIXTURE.rows.map((row) => ({
    key: row.key,
    title: row.title,
    allowedPlanTiers: row.allowedPlanTiers,
    items: row.items?.map((item) => ({
      slug: { current: item.key },
      title: item.title,
      description: item.description ?? null,
      allergens: item.allergens ?? [],
      isVegetarian: item.isVegetarian ?? false,
      allowedPlanTiers: item.allowedPlanTiers,
    })),
  }));
}

describe("lunchCategory catalog parity (editor ≡ employee/order)", () => {
  const catalog = PROD_LUNCH_CATEGORY_FIXTURE;

  it("uses canonical laks-eggerore slug with Sanity allergens", () => {
    const variant = catalogVariantsForTier(catalog, "BASIS").find((v) => v.id === "paasmurt:laks-eggerore");
    expect(variant).toBeDefined();
    expect(variant?.label).toBe("Laks & Eggerøre");
    expect(variant?.allergens).toEqual(["hvete", "egg", "fisk"]);
    expect(catalogVariantsForTier(catalog, "BASIS").some((v) => v.id === "paasmurt:laks-egger")).toBe(false);
  });

  it("shows exact Sanity titles (no contract wok/poké overrides)", () => {
    const sushi = catalogVariantsForTier(catalog, "LUXUS").find((v) => v.category === "sushi");
    expect(sushi?.label).toBe("Sushi-pakke (6 biter MAKI, 2 biter NIGIRI, 1 Tempura)");

    const poke = buildMenuCatalogVariants(catalog).find((v) => v.category === "pokebowl");
    expect(poke?.categoryLabel).toBe("Pokebowl");

    const thai = fixedVariantsFromCatalog(catalog, "LUXUS", "thai");
    expect(thai.map((v) => v.title)).toEqual(["Pad Thai nudler", "Biff peppersaus", "Pad med mamuang"]);
  });

  it("Basis tier hides premium categories and variants", () => {
    expect(providerWorkspaceCategories(catalog, "BASIS")).toEqual(["paasmurt", "salat", "varmrett"]);
    const basisVariants = catalogVariantsForTier(catalog, "BASIS");
    expect(basisVariants.some((v) => v.category === "sushi")).toBe(false);
    expect(basisVariants.some((v) => v.category === "pokebowl")).toBe(false);
    expect(basisVariants.some((v) => v.category === "thai")).toBe(false);

    const sushiRows = resolveVariantRowsForDay({}, "2026-06-16", "BASIS", "sushi", catalog);
    expect(sushiRows).toHaveLength(0);
  });

  it("Luxus/Enterprise show premium categories", () => {
    expect(providerWorkspaceCategories(catalog, "LUXUS")).toEqual([
      "paasmurt",
      "salat",
      "sushi",
      "pokebowl",
      "thai",
      "vegetarian",
      "varmrett",
    ]);
    expect(workspaceCategoriesFromCatalog(catalog, "ENTERPRISE")).toHaveLength(7);
    expect(catalogVariantsForTier(catalog, "LUXUS").some((v) => v.category === "sushi")).toBe(true);
  });

  it("matches staticMenuItemsByCategoryForPlanTier (employee/order path)", () => {
    const sanityRows = fixtureAsSanityRows();
    for (const tier of ["BASIS", "LUXUS", "ENTERPRISE"] as const) {
      const employee = staticMenuItemsByCategoryForPlanTier(sanityRows, tier);
      const editor = catalogVariantsForTier(catalog, tier);

      for (const [category, items] of Object.entries(employee)) {
        if (category === "varmrett") continue;
        const editorItems = editor.filter((v) => v.category === category);
        expect(editorItems.map((v) => v.id.split(":")[1])).toEqual(items?.map((i) => i.key) ?? []);
        for (const item of items ?? []) {
          const match = editorItems.find((v) => v.id.endsWith(`:${item.key}`));
          expect(match?.label).toBe(item.title);
          expect(match?.allergens).toEqual(item.allergens);
        }
      }

      for (const variant of editor) {
        if (variant.category === "varmrett") continue;
        const catItems = employee[variant.category];
        expect(catItems?.some((i) => i.key === variant.id.split(":")[1])).toBe(true);
      }
    }
  });
});
