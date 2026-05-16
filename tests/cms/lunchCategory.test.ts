import { describe, expect, test } from "vitest";
import {
  mapLunchCategoryDocItemsToMenuItems,
  staticMenuItemsByCategoryForPlanTier,
} from "@/lib/cms/lunchCategory";

describe("lunchCategory sanity mapping", () => {
  test("mapper slug.current til item key", () => {
    const items = mapLunchCategoryDocItemsToMenuItems([
      { slug: { current: "kylling-bacon" }, title: "Kylling Bacon", allergens: ["hvete"] },
    ]);
    expect(items).toEqual([
      expect.objectContaining({
        key: "kylling-bacon",
        title: "Kylling Bacon",
        allergens: ["hvete"],
        available: true,
      }),
    ]);
  });

  test("filtrerer tier: BASIS får ikke luxus-only sushi-rad", () => {
    const rows = [
      {
        key: "sushi",
        allowedPlanTiers: ["LUXUS", "ENTERPRISE"],
        items: [{ slug: { current: "pakke" }, title: "Pakke" }],
      },
      {
        key: "paasmurt",
        allowedPlanTiers: ["BASIS", "LUXUS", "ENTERPRISE"],
        items: [{ slug: { current: "a" }, title: "A" }],
      },
    ];
    const basis = staticMenuItemsByCategoryForPlanTier(rows, "BASIS");
    expect(basis.sushi).toBeUndefined();
    expect(basis.paasmurt?.length).toBe(1);
  });

  test("item-nivå allowedPlanTiers: ekskluderer variant for feil tier", () => {
    const items = mapLunchCategoryDocItemsToMenuItems(
      [
        {
          slug: { current: "kun-luxus" },
          title: "Lux",
          allowedPlanTiers: ["LUXUS"],
        },
        {
          slug: { current: "alle" },
          title: "All",
        },
      ],
      "BASIS",
    );
    expect(items.map((i) => i.key)).toEqual(["alle"]);
  });
});
