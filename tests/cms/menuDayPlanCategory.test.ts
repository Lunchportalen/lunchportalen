import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CATEGORIES, CATEGORY_LABELS, PLAN_CATEGORIES } from "@/lib/cms/menuDay";

describe("menuDay plan/category contract", () => {
  it("keeps the canonical category coverage per plan", () => {
    expect(PLAN_CATEGORIES.BASIS).toHaveLength(3);
    expect(PLAN_CATEGORIES.LUXUS).toHaveLength(7);
    expect(PLAN_CATEGORIES.ENTERPRISE).toHaveLength(7);
  });

  it("keeps BASIS categories as a subset of LUXUS", () => {
    expect(PLAN_CATEGORIES.BASIS.every((category) => PLAN_CATEGORIES.LUXUS.includes(category))).toBe(true);
  });

  it("has a label for every category", () => {
    for (const category of CATEGORIES) {
      expect(CATEGORY_LABELS[category]).toBeTruthy();
    }
  });
});
