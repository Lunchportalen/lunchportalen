import { describe, expect, test } from "vitest";

import { buildOrderedMealDisplayLine } from "@/lib/employee/orderedMealDisplay";

describe("buildOrderedMealDisplayLine", () => {
  const base = {
    orderStatus: "ACTIVE" as const,
    selectedChoiceKey: "paasmurt",
    selectedItemKey: "ost-skinke",
    selectedItemTitleSnapshot: null,
    allowedChoices: [{ key: "paasmurt", label: "Påsmurt" }],
    categories: [
      {
        key: "paasmurt",
        label: "Påsmurt",
        items: [{ key: "ost-skinke", title: "Ost & skinke" }],
      },
    ],
  };

  test("ACTIVE + item_key resolves CMS title (not raw slug)", () => {
    expect(buildOrderedMealDisplayLine(base)).toBe("Påsmurt – Ost & skinke");
  });

  test("prefers item_title_snapshot over menu items", () => {
    expect(
      buildOrderedMealDisplayLine({
        ...base,
        selectedItemTitleSnapshot: "Snapshot variant",
      }),
    ).toBe("Påsmurt – Snapshot variant");
  });

  test("returns null when not ACTIVE", () => {
    expect(buildOrderedMealDisplayLine({ ...base, orderStatus: null })).toBeNull();
  });

  test("category only when no variant", () => {
    expect(
      buildOrderedMealDisplayLine({
        ...base,
        selectedItemKey: null,
        categories: [{ key: "paasmurt", label: "Påsmurt", items: [] }],
      }),
    ).toBe("Påsmurt");
  });

  test("CMS miss: unknown slug → category label only, never raw slug", () => {
    expect(
      buildOrderedMealDisplayLine({
        ...base,
        selectedChoiceKey: "varmmat",
        selectedItemKey: "unknown-slug-xyz",
        selectedItemTitleSnapshot: null,
        allowedChoices: [{ key: "varmmat", label: "Varmrett" }],
        categories: [
          {
            key: "varmmat",
            label: "Varmrett",
            items: [{ key: "default", title: "Dagens rett" }],
          },
        ],
      }),
    ).toBe("Varmrett");
  });

  test("single-item Varmrett with CMS match → «Varmrett – tittel»", () => {
    expect(
      buildOrderedMealDisplayLine({
        orderStatus: "ACTIVE",
        selectedChoiceKey: "varmmat",
        selectedItemKey: "default",
        selectedItemTitleSnapshot: null,
        allowedChoices: [{ key: "varmmat", label: "Varmrett" }],
        categories: [
          {
            key: "varmmat",
            label: "Varmrett",
            items: [{ key: "default", title: "Kylling tikka" }],
          },
        ],
      }),
    ).toBe("Varmrett – Kylling tikka");
  });
});
