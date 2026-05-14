// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from "vitest";

const getMenuForDateAndPlanMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cms/menuDay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/menuDay")>();
  return {
    ...actual,
    getMenuForDateAndPlan: getMenuForDateAndPlanMock,
  };
});

import { resolveOrderDayItemPersist } from "@/lib/orders/resolveOrderDayItemPersist";

describe("resolveOrderDayItemPersist", () => {
  beforeEach(() => {
    getMenuForDateAndPlanMock.mockReset();
  });

  test("ITEM_CHOICE_REQUIRED når minst to items og ingen itemKey", async () => {
    getMenuForDateAndPlanMock.mockResolvedValue([
      {
        category: "salat",
        mealTitle: "Salatdag",
        items: [
          { key: "kylling", title: "Kylling", allergens: [], isVegetarian: false, available: true },
          { key: "vegetar", title: "Vegetar", allergens: [], isVegetarian: true, available: true },
        ],
      },
    ]);

    const r = await resolveOrderDayItemPersist({
      date: "2026-05-19",
      planTier: "BASIS",
      choiceKey: "salatboks",
      clientItemKey: null,
    });

    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.code).toBe("ITEM_CHOICE_REQUIRED");
  });

  test("setter item_key og item_title_snapshot fra menuDay ved treff", async () => {
    getMenuForDateAndPlanMock.mockResolvedValue([
      {
        category: "salat",
        mealTitle: "Salatdag",
        items: [
          { key: "kylling", title: "  Kylling  ", allergens: [], isVegetarian: false, available: true },
          { key: "vegetar", title: "Vegetar", allergens: [], isVegetarian: true, available: true },
        ],
      },
    ]);

    const r = await resolveOrderDayItemPersist({
      date: "2026-05-19",
      planTier: "BASIS",
      choiceKey: "salatboks",
      clientItemKey: "kylling",
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.item_key).toBe("kylling");
      expect(r.item_title_snapshot).toBe("Kylling");
    }
  });

  test("INVALID_ITEM_CHOICE ved ukjent itemKey med flere items", async () => {
    getMenuForDateAndPlanMock.mockResolvedValue([
      {
        category: "pokebowl",
        mealTitle: "Poke",
        items: [
          { key: "laks", title: "Laks", allergens: [], isVegetarian: false, available: true },
          { key: "tofu", title: "Tofu", allergens: [], isVegetarian: true, available: true },
        ],
      },
    ]);

    const r = await resolveOrderDayItemPersist({
      date: "2026-05-21",
      planTier: "ENTERPRISE",
      choiceKey: "pokebowl",
      clientItemKey: "ingen",
    });

    expect(r.ok).toBe(false);
    expect(r.ok ? null : r.code).toBe("INVALID_ITEM_CHOICE");
  });

  test("nullfelt når én eller ingen item-rad selv om client sender itemKey", async () => {
    getMenuForDateAndPlanMock.mockResolvedValue([
      {
        category: "salat",
        mealTitle: "Bare én variant",
        items: [{ key: "solo", title: "Solo", allergens: [], isVegetarian: false, available: true }],
      },
    ]);

    const r = await resolveOrderDayItemPersist({
      date: "2026-05-21",
      planTier: "BASIS",
      choiceKey: "salatboks",
      clientItemKey: "kylling",
    });

    expect(r).toEqual({ ok: true, item_key: null, item_title_snapshot: null });
  });

  test("MATCH med case-insensitiv lookup (bevarer CMS key casing)", async () => {
    getMenuForDateAndPlanMock.mockResolvedValue([
      {
        category: "pokebowl",
        mealTitle: "Poke",
        items: [
          { key: "Laks", title: "  Laks  ", allergens: [], isVegetarian: false, available: true },
          { key: "tofu", title: "Tofu", allergens: [], isVegetarian: true, available: true },
        ],
      },
    ]);

    const r = await resolveOrderDayItemPersist({
      date: "2026-05-21",
      planTier: "ENTERPRISE",
      choiceKey: "pokebowl",
      clientItemKey: "laks",
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.item_key).toBe("Laks");
      expect(r.item_title_snapshot).toBe("Laks");
    }
  });
});
