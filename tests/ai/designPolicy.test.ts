import { describe, expect, test } from "vitest";

import {
  assertMaxPatchKeys,
  assertNoRapidToggle,
  capSuggestions,
  dedupeSuggestionsByKey,
  designPatchAffectedKeys,
} from "@/lib/ai/design/designPolicy";
import type { DesignImprovementSuggestion } from "@/lib/ai/design/types";

function sug(
  id: DesignImprovementSuggestion["id"],
  key: string,
  risk: DesignImprovementSuggestion["risk"],
): DesignImprovementSuggestion {
  return {
    id,
    key,
    from: "a",
    to: "b",
    reason: "r",
    risk,
    patch: key === "spacing.section" ? { spacing: { section: "wide" } } : { layout: { container: "wide" } },
  };
}

describe("designPolicy", () => {
  test("designPatchAffectedKeys lists spacing and card hover", () => {
    const keys = designPatchAffectedKeys({
      spacing: { section: "normal" },
      card: { cta: { hover: "lift" } },
    });
    expect(keys).toContain("spacing.section");
    expect(keys).toContain("card.cta.hover");
  });

  test("assertMaxPatchKeys rejects more than 3 keys", () => {
    const r = assertMaxPatchKeys(
      {
        spacing: { section: "wide" },
        surface: { section: "contrast" },
        typography: { heading: "display", body: "compact" },
        layout: { container: "wide" },
      },
      3,
    );
    expect(r.ok).toBe(false);
  });

  test("dedupeSuggestionsByKey keeps higher risk for same key", () => {
    const list = dedupeSuggestionsByKey([
      sug("LAYOUT_WIDE_CARDS", "layout.container", "low"),
      {
        id: "SURFACE_CONTRAST",
        key: "layout.container",
        from: "a",
        to: "b",
        reason: "r",
        risk: "medium",
        patch: { layout: { container: "wide" } },
      },
    ]);
    expect(list.length).toBe(1);
    expect(list[0]!.risk).toBe("medium");
  });

  test("capSuggestions", () => {
    expect(capSuggestions([sug("SPACING_TIGHT", "spacing.section", "low")], 0)).toEqual([]);
  });

  test("assertNoRapidToggle blocks overlapping keys in cooldown", () => {
    const r = assertNoRapidToggle(["spacing.section"], { at: Date.now(), keys: ["spacing.section"] }, 60_000);
    expect(r.ok).toBe(false);
  });
});
