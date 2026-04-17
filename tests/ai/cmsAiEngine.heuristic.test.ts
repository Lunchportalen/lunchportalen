import { describe, expect, test } from "vitest";
import { heuristicImproveMenu, scoreMenuQuality } from "@/lib/ai/cmsAiEngine";

describe("cmsAiEngine heuristics", () => {
  test("scoreMenuQuality penalizes short title", () => {
    const r = scoreMenuQuality({ title: "X", description: "Short" });
    expect(r.score).toBeLessThan(100);
    expect(r.issues.length).toBeGreaterThan(0);
  });

  test("scoreMenuQuality is high for solid menu", () => {
    const r = scoreMenuQuality({
      mealType: "varmmat",
      title: "Dagens varmmat",
      description: "Kjøttkaker med stuing, rotgrønnsaker og tyttebær.",
      allergens: ["Gluten", "Melk"],
    });
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  test("heuristicImproveMenu trims fields", () => {
    const r = heuristicImproveMenu({
      title: "  abc  ",
      description: "  ",
      allergens: ["  a ", ""],
    });
    expect(r.title).toBe("abc");
    expect(r.allergens).toEqual(["a"]);
  });
});
