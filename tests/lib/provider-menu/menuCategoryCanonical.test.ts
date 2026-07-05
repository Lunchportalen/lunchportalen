import { describe, expect, it } from "vitest";

import {
  canonicalMenuCategory,
  categoriesForTierInOrder,
  menuSlotHasContent,
  PROVIDER_MENU_CATEGORY_ORDER,
} from "@/lib/provider-menu/menuCategoryCanonical";
import { PLAN_CATEGORIES } from "@/lib/cms/menuDayContract";

describe("menuCategoryCanonical", () => {
  it.each([
    ["paasmurt", "paasmurt"],
    ["PÅSMURT", "paasmurt"],
    ["salatboks", "salat"],
    ["SALAD", "salat"],
    ["poke", "pokebowl"],
    ["thaimat", "thai"],
    ["varmmat", "varmrett"],
    ["WARM_MEAL", "varmrett"],
  ])("maps alias %s → %s", (input, expected) => {
    expect(canonicalMenuCategory(input)).toBe(expected);
  });

  it("keeps stable category order", () => {
    expect(PROVIDER_MENU_CATEGORY_ORDER).toEqual([
      "paasmurt",
      "salat",
      "sushi",
      "pokebowl",
      "thai",
      "vegetarian",
      "varmrett",
    ]);
  });

  it("filters tier categories in stable order", () => {
    expect(categoriesForTierInOrder(PLAN_CATEGORIES.LUXUS)).toEqual([
      "paasmurt",
      "salat",
      "sushi",
      "pokebowl",
      "thai",
      "vegetarian",
      "varmrett",
    ]);
  });

  it("menuSlotHasContent detects real titles", () => {
    expect(menuSlotHasContent({ mealTitle: "Kyllinggryte", description: "" })).toBe(true);
    expect(menuSlotHasContent({ mealTitle: "Utkast", description: "" })).toBe(false);
    expect(menuSlotHasContent({ mealTitle: "", description: "" })).toBe(false);
  });
});
