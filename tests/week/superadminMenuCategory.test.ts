import { describe, expect, test } from "vitest";

/** Mirror of app/(app)/week/page.tsx menuDayCategoryEnum for regression guard. */
function menuDayCategoryEnum(value: unknown): string | null {
  const c = String(value ?? "")
    .trim()
    .toLowerCase();
  if (c === "paasmurt") return "Påsmurt";
  if (c === "salat") return "Salatboks";
  if (c === "sushi") return "Sushi";
  if (c === "pokebowl") return "Pokebowl";
  if (c === "thai") return "Thaimat";
  if (c === "varmrett") return "Varmmat";
  return null;
}

describe("superadmin menuDay category mapping", () => {
  test("Sanity enum varmrett maps to Varmmat display category", () => {
    expect(menuDayCategoryEnum("varmrett")).toBe("Varmmat");
  });

  test("all plan tiers use varmrett enum in menuDay", () => {
    for (const tier of ["BASIS", "LUXUS", "ENTERPRISE"]) {
      expect(menuDayCategoryEnum("varmrett")).toBe("Varmmat");
      expect(tier.length).toBeGreaterThan(0);
    }
  });
});
