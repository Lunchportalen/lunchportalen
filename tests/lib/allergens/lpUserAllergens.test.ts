import { describe, expect, test } from "vitest";

import {
  LP_ALLERGEN_CODES,
  normalizeLpAllergenCodes,
  normalizeLpAllergenFreeText,
} from "@/lib/allergens/lpUserAllergens";

describe("lpUserAllergens", () => {
  test("LP_ALLERGEN_CODES has 14 EU entries", () => {
    expect(LP_ALLERGEN_CODES).toHaveLength(14);
  });

  test("normalizeLpAllergenCodes dedupes and filters invalid", () => {
    expect(normalizeLpAllergenCodes(["gluten", "gluten", "invalid", "milk"])).toEqual(["gluten", "milk"]);
  });

  test("normalizeLpAllergenFreeText caps at 280", () => {
    expect(normalizeLpAllergenFreeText("a".repeat(400)).length).toBe(280);
  });
});
