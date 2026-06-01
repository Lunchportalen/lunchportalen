import { describe, expect, test } from "vitest";

import {
  LP_ALLERGEN_CODES,
  normalizeLpAllergenCodes,
  normalizeLpAllergenFreeText,
  resolveEmployeeAllergenProfileStatus,
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

  test("resolveEmployeeAllergenProfileStatus distinguishes three safety states", () => {
    expect(resolveEmployeeAllergenProfileStatus(null)).toBe("unknown");
    expect(resolveEmployeeAllergenProfileStatus(undefined)).toBe("unknown");
    expect(resolveEmployeeAllergenProfileStatus({ codes: [], free_text: "" })).toBe("declared_empty");
    expect(resolveEmployeeAllergenProfileStatus({ codes: ["gluten"], free_text: "" })).toBe("has_data");
    expect(resolveEmployeeAllergenProfileStatus({ codes: [], free_text: "Kryss" })).toBe("has_data");
  });
});
