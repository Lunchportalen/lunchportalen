import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const CLIENT_PATH = join(process.cwd(), "app", "(app)", "week", "EmployeeWeekClient.tsx");
const CSS_PATH = join(process.cwd(), "app", "styles", "employee-week.css");

describe("week category cards", () => {
  test("category card markup is minimal: label + unavailable helper only (no legacy title/description on card)", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain("export function WeekCategoryCards");
    expect(source).toContain("week-category-card__label");
    expect(source.includes("week-category-card__title")).toBe(false);
    expect(source.includes("week-category-card__desc")).toBe(false);

    expect(source).toContain("Ikke tilgjengelig");
  });

  test("expanded panel: radiogrid when minst to valgbare items; Velg-variant title kun da", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain("isSelectableItems");
    expect(source).toContain(`Velg variant for ${"${selectedCat.label}"}`);
    expect(source).toContain('role={isSelectableItems ? "radiogroup" : "region"}');
    expect(source).toContain("ds-week-items-grid");
    expect(source).toContain('role="radio"');
  });

  test("én fast variant (sushi-pakke): info-kort, ikke radio", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain("itemCount === 1");
    expect(source).toContain("ds-week-info-card__title");
  });

  test("expanded panel: info card mode for zero items with title/description", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain("showInfoCard");
    expect(source).toContain("ds-week-info-card");
    expect(source).toContain("ds-week-info-card__title");
    expect(source).toContain("ds-week-info-card__desc");
    expect(source).toContain("ds-week-info-card__meta");
    expect(source).toContain("ds-allergen-badge");
  });

  test("empty CMS category shows placeholder status text", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain("showEmptyMenuPlaceholder");
    expect(source).toContain("ds-week-info-card__placeholder");
    expect(source).toContain("Ingen meny lagt inn enda");
  });

  test("ordered vs pending: bestilt card is not pending-selection styling", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    const fnStart = source.indexOf("export function WeekCategoryCards");
    const fnEnd = source.indexOf("\nfunction DayMenuSummary", fnStart);
    const block = source.slice(fnStart, fnEnd);

    // Bestilt = system truth (order snapshot); pending = user is changing choice on ACTIVE day.
    expect(block).toContain("const isPendingCat = isSelected && !isOrdered");
    expect(block).toContain('isOrdered ? "is-ordered" : ""');
    expect(block).toContain('isPendingCat ? "is-selected" : ""');
    expect(block.includes('isSelected ? "is-selected"')).toBe(false);

    expect(block).toContain("week-category-card__ordered-tag");
    expect(block).toContain("Bestilt");
    expect(block).toContain("aria-pressed={isOrdered || isPendingCat}");
    expect(block).toContain("onClick={() => onSelectCategory(cat.key)}");
    expect(block).toContain("isOrdered ? `${cat.label}, bestilt`");
    expect(block).toContain("isPendingCat ? `${cat.label}, valgt`");
  });

  test("category toggle: selectCategory clears same key and resets item (ghost guard)", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain("effectiveSelectedChoice(day, prev[date])");
    expect(source).toContain("currentEff.toLowerCase() === choiceKey.toLowerCase()");
    expect(source).toContain("[date]: null");
    expect(source).toContain("itemKey: null");
  });

  test("expand renders inline only for pending selection (not for bestilt-only card)", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    const fnStart = source.indexOf("export function WeekCategoryCards");
    const fnEnd = source.indexOf("\nfunction DayMenuSummary", fnStart);
    expect(fnStart).toBeGreaterThan(-1);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const block = source.slice(fnStart, fnEnd);
    expect(block).toContain("Fragment key={cat.key}");
    expect(block).toContain("ds-week-items-section--inline");
    expect(block).toContain("{isPendingCat ? expandSection : null}");
    expect(block.includes("{isSelected ? expandSection : null}")).toBe(false);
    expect(block).toContain('className="week-day__categories"');
    const closesCategories = block.lastIndexOf("</div>");
    const expandInMap = block.indexOf("{isPendingCat ? expandSection : null}");
    expect(expandInMap).toBeGreaterThan(-1);
    expect(expandInMap).toBeLessThan(closesCategories);
  });

  test("explicit clear: effectiveSelectedChoice returns null only for stored === null", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toMatch(/if \(stored === null\) return null;\s*\n\s*const parsed = parseStoredSelection/);
  });

  test("CSS: inline expand spans full grid row on desktop", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain(".ds-week-items-section--inline");
    expect(css).toContain("grid-column: 1 / -1");
  });

  test("CSS: bestilt category card uses is-ordered (distinct from pending is-selected)", () => {
    const css = readFileSync(CSS_PATH, "utf-8");
    expect(css).toContain(".week-category-card.is-ordered");
    expect(css).toContain(".ds-ordered-meal-line");
  });

  test("category cards disable when unavailable; CSS keeps 48px touch + motion/focus tokens", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    const css = readFileSync(CSS_PATH, "utf-8");

    expect(source).toContain("disabled={disabled || !cat.available || !day.isEnabled}");
    expect(css).toContain("min-height: 48px");
    expect(css).toContain(".week-category-card:focus-visible");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".ds-week-info-card");
    expect(css).toContain(".ds-week-info-card__meta");
  });

  test("variant-pending line uses Velg variant (not Valgt-prefix)", () => {
    const source = readFileSync(CLIENT_PATH, "utf-8");
    expect(source).toContain(`Velg variant for ${"${highlightLine.categoryLabel}"}`);
    expect(source).toContain("choiceHighlightLine");
    expect(source).toContain('highlightLine.mode === "variant_pending"');
  });
});
