import { describe, expect, it } from "vitest";

import {
  buildMenuDaySeedDocs,
  pickMealIdeaForCategory,
  weekdaysForWeekStart,
  type MealIdea,
} from "@/scripts/sanity/seed-menu-week";

const meals: MealIdea[] = Array.from({ length: 40 }, (_, index) => ({
  _id: `mealIdea.${String(index + 1).padStart(4, "0")}`,
  title: `Meal ${index + 1}`,
  description: `Description ${index + 1}`,
}));

describe("seed menu week script", () => {
  it("picks meal ideas deterministically for the same input", () => {
    const first = pickMealIdeaForCategory(meals, "varmrett", "ENTERPRISE", 2);
    const second = pickMealIdeaForCategory(meals, "varmrett", "ENTERPRISE", 2);

    expect(first._id).toBe(second._id);
  });

  it("generates 75 menuDay documents for one week", () => {
    const docs = buildMenuDaySeedDocs("2026-06-01", meals, "2026-05-12T12:00:00.000Z");

    expect(docs).toHaveLength(75);
    expect(docs.filter((doc) => doc.planTier === "BASIS")).toHaveLength(15);
    expect(docs.filter((doc) => doc.planTier === "LUXUS")).toHaveLength(30);
    expect(docs.filter((doc) => doc.planTier === "ENTERPRISE")).toHaveLength(30);
  });

  it("generates Monday through Friday dates", () => {
    expect(weekdaysForWeekStart("2026-06-01")).toEqual([
      "2026-06-01",
      "2026-06-02",
      "2026-06-03",
      "2026-06-04",
      "2026-06-05",
    ]);
  });

  it("throws when week-start is not a Monday", () => {
    expect(() => weekdaysForWeekStart("2026-06-02")).toThrow("må være en mandag");
  });
});
