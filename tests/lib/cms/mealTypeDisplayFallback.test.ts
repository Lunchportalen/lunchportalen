import { describe, it, expect } from "vitest";

import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";

describe("displayLabelForMealTypeKey", () => {
  it("prefers CMS title when present", () => {
    expect(displayLabelForMealTypeKey("paasmurt", { title: "Påsmurt spesial" })).toBe("Påsmurt spesial");
  });

  it("maps known keys to Norwegian labels", () => {
    expect(displayLabelForMealTypeKey("paasmurt")).toBe("Påsmurt");
    expect(displayLabelForMealTypeKey("salatboks")).toBe("Salatboks");
  });

  it("never leaks raw snake_case keys for unknown meal types (Fase E fail-closed)", () => {
    expect(displayLabelForMealTypeKey("veggie_bowl")).toBe("Veggie bowl");
    expect(displayLabelForMealTypeKey("some-new-dish")).toBe("Some new dish");
    expect(displayLabelForMealTypeKey("veggie_bowl")).not.toContain("_");
  });

  it("empty key gets a neutral label", () => {
    expect(displayLabelForMealTypeKey("")).toBe("Lunsj");
  });
});
