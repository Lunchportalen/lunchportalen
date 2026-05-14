import { describe, expect, test } from "vitest";
import { buildLegacyChoiceCategories, buildMenuDayCategories } from "@/app/api/order/window/route";
import type { MenuItemData } from "@/lib/cms/menuDay";

describe("/api/order/window menuDay categories", () => {
  test("BASIS company gets three categories", () => {
    const categories = buildMenuDayCategories({ planTier: "BASIS", menus: [] });

    expect(categories.map((c) => c.category)).toEqual(["paasmurt", "salat", "varmrett"]);
    expect(categories.map((c) => c.key)).toEqual(["paasmurt", "salatboks", "varmmat"]);
  });

  test("LUXUS company gets six categories", () => {
    const categories = buildMenuDayCategories({ planTier: "LUXUS", menus: [] });

    expect(categories.map((c) => c.category)).toEqual(["paasmurt", "salat", "sushi", "pokebowl", "thai", "varmrett"]);
  });

  test("ENTERPRISE company gets six categories", () => {
    const categories = buildMenuDayCategories({ planTier: "ENTERPRISE", menus: [] });

    expect(categories.map((c) => c.category)).toEqual(["paasmurt", "salat", "sushi", "pokebowl", "thai", "varmrett"]);
  });

  test("date without menuDay data exposes unavailable categories", () => {
    const categories = buildMenuDayCategories({ planTier: "BASIS", menus: [] });

    expect(categories).toHaveLength(3);
    expect(categories.every((c) => c.available === false)).toBe(true);
  });

  test("legacy fallback preserves behavior for companies without tier data", () => {
    const categories = buildLegacyChoiceCategories([{ key: "varmmat", label: "Varmrett" }], true);

    expect(categories).toEqual([
      {
        key: "varmmat",
        category: "varmrett",
        label: "Varmrett",
        title: null,
        description: null,
        allergens: [],
        available: true,
        items: [],
      },
    ]);
  });

  test("menuDay exposes items[], omits unavailable, defaults allergens", () => {
    const items: MenuItemData[] = [
      { key: "one", title: "One", allergens: ["melk"], isVegetarian: false, available: true },
      { key: "two", title: "Hidden", allergens: ["egg"], isVegetarian: false, available: false },
      // narrow doc without allergens (runtime guard)
      { key: "three", title: "Three", allergens: [], isVegetarian: true, available: true },
    ];
    const categories = buildMenuDayCategories({
      planTier: "LUXUS",
      menus: [
        {
          category: "salat",
          mealTitle: "Meny linje salat",
          items: [...items.slice(0, 2), { ...items[2]!, allergens: undefined as unknown as string[] }],
        },
      ],
    });
    const salat = categories.find((c) => c.category === "salat");
    expect(salat?.items.map((x) => x.key)).toEqual(["one", "three"]);
    expect(salat?.items.find((x) => x.key === "one")?.allergens).toEqual(["melk"]);
    expect(salat?.items.find((x) => x.key === "three")?.allergens).toEqual([]);
    expect(salat?.items.find((x) => x.key === "three")?.isVegetarian).toBe(true);
    expect(buildMenuDayCategories({ planTier: "BASIS", menus: [] }).every((c) => Array.isArray(c.items))).toBe(true);
  });
});