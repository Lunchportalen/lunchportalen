import { describe, expect, test } from "vitest";

import {
  buildKitchenMealNote,
  parseVariantFromLegacyNote,
  resolveVariantTitleFromLookup,
} from "@/lib/kitchen/kitchenMealNote";

describe("kitchenMealNote", () => {
  const lookup = new Map<string, string>([
    ["paasmurt:ost-skinke", "Ost & skinke"],
    ["salatboks:kylling", "Kylling"],
  ]);

  test("resolveVariantTitleFromLookup matches normalized choice_key", () => {
    expect(resolveVariantTitleFromLookup("paasmurt", "ost-skinke", lookup)).toBe("Ost & skinke");
  });

  test("buildKitchenMealNote shows variant from item_key lookup (kjøkken-bindende)", () => {
    const note = buildKitchenMealNote({
      choiceKey: "paasmurt",
      itemKey: "ost-skinke",
      itemTitleSnapshot: null,
      note: null,
      menuByMeal: new Map(),
      variantLookup: lookup,
    });
    expect(note).toBe("Påsmurt (Ost & skinke)");
  });

  test("item_title_snapshot wins over item_key lookup", () => {
    const note = buildKitchenMealNote({
      choiceKey: "paasmurt",
      itemKey: "ost-skinke",
      itemTitleSnapshot: "Fra snapshot",
      note: null,
      menuByMeal: new Map(),
      variantLookup: lookup,
    });
    expect(note).toBe("Påsmurt (Fra snapshot)");
  });

  test("legacy note parse still works when item_key absent", () => {
    const menuByMeal = new Map();
    const legacy = parseVariantFromLegacyNote("paasmurt", "Påsmurt: Ost & skinke", menuByMeal);
    expect(legacy).toBe("Ost & skinke");
    const note = buildKitchenMealNote({
      choiceKey: "paasmurt",
      itemKey: null,
      note: "Påsmurt: Ost & skinke",
      menuByMeal,
      variantLookup: lookup,
    });
    expect(note).toBe("Påsmurt (Ost & skinke)");
  });
});
