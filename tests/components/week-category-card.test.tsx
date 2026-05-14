import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const CLIENT_PATH = join(process.cwd(), "app", "(app)", "week", "EmployeeWeekClient.tsx");
const CSS_PATH = join(process.cwd(), "app", "styles", "employee-week.css");

describe("week category cards", () => {
  test("renders label, title, description and unavailable state hooks", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");

    expect(source).toContain("export function WeekCategoryCards");
    expect(source).toContain("week-category-card__label");
    expect(source).toContain("week-category-card__title");
    expect(source).toContain("week-category-card__desc");
    expect(source).toContain("Ikke tilgjengelig");
  });

  test("clicking a card triggers onSelectCategory and selected state uses aria-pressed", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");

    expect(source).toContain("onClick={() => onSelectCategory(cat.key)}");
    expect(source).toContain("aria-pressed={isSelected}");
    expect(source).toContain('isSelected ? "is-selected" : ""');
  });

  test("category cards are disabled when unavailable and keep 48px touch target", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    const css = readFileSync(CSS_PATH, "utf-8");

    expect(source).toContain("disabled={disabled || !cat.available || !day.isEnabled}");
    expect(css).toContain("min-height: 48px");
    expect(css).toContain(".week-category-card:focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
