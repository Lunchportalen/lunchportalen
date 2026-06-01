import { describe, expect, test } from "vitest";

import {
  LP_ALLERGEN_CATEGORY_CODES,
  LP_ALLERGEN_CODES,
  LP_GLUTEN_SUBTYPE_CODES,
  LP_TREE_NUT_SUBTYPE_CODES,
  allergenCodesForKitchenDisplay,
  formatLpAllergenCodesForKitchen,
  labelLpAllergenCodeForKitchen,
  normalizeLpAllergenCodes,
  normalizeLpAllergenFreeText,
  resolveEmployeeAllergenProfileStatus,
} from "@/lib/allergens/lpUserAllergens";

describe("lpUserAllergens", () => {
  test("LP_ALLERGEN_CATEGORY_CODES has 14 EU entries", () => {
    expect(LP_ALLERGEN_CATEGORY_CODES).toHaveLength(14);
  });

  test("LP_ALLERGEN_CODES includes categories and Mattilsynet undertyper", () => {
    expect(LP_ALLERGEN_CODES).toHaveLength(
      LP_ALLERGEN_CATEGORY_CODES.length + LP_GLUTEN_SUBTYPE_CODES.length + LP_TREE_NUT_SUBTYPE_CODES.length,
    );
    expect(LP_ALLERGEN_CODES).toContain("gluten_wheat");
    expect(LP_ALLERGEN_CODES).toContain("nut_almond");
  });

  test("normalizeLpAllergenCodes dedupes and filters invalid", () => {
    expect(normalizeLpAllergenCodes(["gluten", "gluten", "invalid", "milk", "gluten_wheat"])).toEqual([
      "gluten",
      "milk",
      "gluten_wheat",
    ]);
  });

  test("normalizeLpAllergenFreeText caps at 280", () => {
    expect(normalizeLpAllergenFreeText("a".repeat(400)).length).toBe(280);
  });

  test("resolveEmployeeAllergenProfileStatus distinguishes three safety states", () => {
    expect(resolveEmployeeAllergenProfileStatus(null)).toBe("unknown");
    expect(resolveEmployeeAllergenProfileStatus(undefined)).toBe("unknown");
    expect(resolveEmployeeAllergenProfileStatus({ codes: [], free_text: "" })).toBe("declared_empty");
    expect(resolveEmployeeAllergenProfileStatus({ codes: ["gluten"], free_text: "" })).toBe("has_data");
    expect(resolveEmployeeAllergenProfileStatus({ codes: ["gluten_wheat"], free_text: "" })).toBe("has_data");
    expect(resolveEmployeeAllergenProfileStatus({ codes: [], free_text: "Kryss" })).toBe("has_data");
  });

  test("allergenCodesForKitchenDisplay prefers undertyper over uspesifisert parent", () => {
    expect(allergenCodesForKitchenDisplay(["gluten", "gluten_wheat", "milk"])).toEqual(["gluten_wheat", "milk"]);
    expect(allergenCodesForKitchenDisplay(["tree_nuts", "nut_hazelnut"])).toEqual(["nut_hazelnut"]);
    expect(allergenCodesForKitchenDisplay(["gluten", "tree_nuts"])).toEqual(["gluten", "tree_nuts"]);
  });

  test("labelLpAllergenCodeForKitchen and format use specific undertype labels", () => {
    expect(labelLpAllergenCodeForKitchen("gluten_wheat")).toBe("Hvete");
    expect(labelLpAllergenCodeForKitchen("nut_walnut")).toBe("Valnøtt");
    expect(formatLpAllergenCodesForKitchen(["gluten", "gluten_wheat", "nut_hazelnut"])).toBe("Hvete, Hasselnøtt");
  });
});
