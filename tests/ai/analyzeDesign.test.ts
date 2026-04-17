import { describe, expect, test } from "vitest";

import { analyzeDesign } from "@/lib/ai/design/analyzeDesign";
import { parseDesignSettingsFromSettingsData } from "@/lib/cms/design/designContract";

describe("analyzeDesign", () => {
  test("emits spacing issue when tight and enough blocks", () => {
    const ds = parseDesignSettingsFromSettingsData({
      designSettings: { spacing: { section: "tight" } },
    });
    const { issues } = analyzeDesign({
      blocks: Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, type: "richText" })),
      designSettings: ds,
      locale: "nb",
    });
    expect(issues.some((i) => i.code === "SPACING_TIGHT")).toBe(true);
    expect(issues.find((i) => i.code === "SPACING_TIGHT")?.current).toBe("tight");
  });

  test("emits hierarchy issue with hero and many blocks", () => {
    const ds = parseDesignSettingsFromSettingsData({});
    const blocks = [
      { id: "h", type: "hero" },
      ...Array.from({ length: 4 }, (_, i) => ({ id: `b${i}`, type: "richText" })),
    ];
    const { issues } = analyzeDesign({ blocks, designSettings: ds, locale: "nb" });
    expect(issues.some((i) => i.code === "TYPO_HIERARCHY")).toBe(true);
  });
});
