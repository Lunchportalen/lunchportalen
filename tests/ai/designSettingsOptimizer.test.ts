import { describe, expect, test } from "vitest";

import {
  analyzeDesignSettingsOptimizer,
  extractDesignSettingsForStorage,
  mergeDesignOptimizerPatches,
  sanitizeDesignSettingsPatch,
} from "@/lib/ai/design/designSettingsOptimizer";

const manyBlocks = Array.from({ length: 9 }, (_, i) => ({
  id: `b${i}`,
  type: i === 0 ? "hero" : i === 1 ? "richText" : i === 2 ? "richText" : "cards",
}));

describe("analyzeDesignSettingsOptimizer", () => {
  test("suggests spacing relax when tight and enough blocks", () => {
    const { suggestions } = analyzeDesignSettingsOptimizer({
      blocks: manyBlocks.slice(0, 5),
      settingsDataRoot: {
        designSettings: { spacing: { section: "tight" } },
      },
      locale: "nb",
    });
    const sp = suggestions.find((s) => s.id === "spacing_relax_tight");
    expect(sp).toBeDefined();
    expect(sp?.patch).toEqual({ spacing: { section: "normal" } });
    expect(sp?.signals.length).toBeGreaterThan(0);
  });

  test("suggests wide spacing for long pages", () => {
    const { suggestions } = analyzeDesignSettingsOptimizer({
      blocks: manyBlocks,
      settingsDataRoot: { designSettings: { spacing: { section: "normal" } } },
      locale: "nb",
    });
    expect(suggestions.some((s) => s.id === "spacing_widen_dense")).toBe(true);
  });

  test("sanitizeDesignSettingsPatch rejects unknown enums", () => {
    expect(sanitizeDesignSettingsPatch({ spacing: { section: "mega" } })).toBeNull();
    expect(sanitizeDesignSettingsPatch({ spacing: { section: "wide" } })).toEqual({
      spacing: { section: "wide" },
    });
  });

  test("mergeDesignOptimizerPatches combines card and spacing", () => {
    const m = mergeDesignOptimizerPatches([
      { spacing: { section: "wide" } },
      { card: { cta: { hover: "lift" } } },
    ]);
    expect(m.spacing?.section).toBe("wide");
    expect(m.card?.cta).toEqual({ hover: "lift" });
  });

  test("extractDesignSettingsForStorage drops junk keys", () => {
    const out = extractDesignSettingsForStorage({
      evil: 1,
      spacing: { section: "normal" },
      card: { cta: { hover: "nope" } },
    } as Record<string, unknown>);
    expect(out.evil).toBeUndefined();
    expect(out.spacing).toEqual({ section: "normal" });
    expect(out.card).toBeUndefined();
  });
});
