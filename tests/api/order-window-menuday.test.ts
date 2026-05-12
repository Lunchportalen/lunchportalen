import { describe, expect, test } from "vitest";
import { buildLegacyChoiceCategories, buildMenuDayCategories } from "@/app/api/order/window/route";

describe("/api/order/window menuDay categories", () => {
  test("BASIS company gets three categories", () => {
    const categories = buildMenuDayCategories({ planTier: "BASIS", menus: [] });

    expect(categories.map((c) => c.category)).toEqual(["paasmurt", "salat", "varmrett"]);
    expect(categories.map((c) => c.key)).toEqual(["paasmurt", "salatbar", "varmmat"]);
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
      },
    ]);
  });
});
