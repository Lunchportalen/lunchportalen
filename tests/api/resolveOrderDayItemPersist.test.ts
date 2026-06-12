// @ts-nocheck
import { beforeEach, describe, expect, test, vi } from "vitest";

const getMenuForDateAndPlanMock = vi.hoisted(() => vi.fn());
const getLunchCategoryStaticItemsByPlanTierMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/cms/menuDay", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/cms/menuDay")>();
  return {
    ...actual,
    getMenuForDateAndPlan: getMenuForDateAndPlanMock,
  };
});

vi.mock("@/lib/cms/lunchCategory", () => ({
  getLunchCategoryStaticItemsByPlanTier: getLunchCategoryStaticItemsByPlanTierMock,
}));

import { resolveOrderDayItemPersist } from "@/lib/orders/resolveOrderDayItemPersist";

describe("resolveOrderDayItemPersist", () => {
  beforeEach(() => {
    getMenuForDateAndPlanMock.mockReset();
    getLunchCategoryStaticItemsByPlanTierMock.mockReset();
    getLunchCategoryStaticItemsByPlanTierMock.mockResolvedValue({});
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

  test("scoped menuScope sender providerSlug til getMenuForDateAndPlan", async () => {
    getMenuForDateAndPlanMock.mockResolvedValue([]);

    await resolveOrderDayItemPersist({
      date: "2026-05-19",
      planTier: "BASIS",
      choiceKey: "salatboks",
      clientItemKey: null,
      menuScope: { mode: "scoped", providerId: "prov-a-id", providerSlug: "provider-a" },
    });

    expect(getMenuForDateAndPlanMock).toHaveBeenCalledWith("2026-05-19", "BASIS", { providerSlug: "provider-a" });
  });

  test("A/B-isolasjon: Provider B-scope spør aldri med Provider A-slug", async () => {
    getMenuForDateAndPlanMock.mockResolvedValue([]);

    await resolveOrderDayItemPersist({
      date: "2026-05-19",
      planTier: "BASIS",
      choiceKey: "salatboks",
      clientItemKey: null,
      menuScope: { mode: "scoped", providerId: "prov-b-id", providerSlug: "provider-b" },
    });

    expect(getMenuForDateAndPlanMock).toHaveBeenCalledTimes(1);
    expect(getMenuForDateAndPlanMock).toHaveBeenCalledWith("2026-05-19", "BASIS", { providerSlug: "provider-b" });
  });

  test("fail-closed menuScope henter aldri menuDay — statisk katalog brukes alene", async () => {
    getLunchCategoryStaticItemsByPlanTierMock.mockResolvedValue({
      salat: [
        { key: "skinke", title: "Skinke", allergens: [], isVegetarian: false, available: true },
        { key: "kylling", title: "Kylling", allergens: [], isVegetarian: false, available: true },
      ],
    });

    const r = await resolveOrderDayItemPersist({
      date: "2026-05-19",
      planTier: "BASIS",
      choiceKey: "salatboks",
      clientItemKey: "kylling",
      menuScope: { mode: "fail-closed", reason: "LOOKUP_FAILED" },
    });

    expect(getMenuForDateAndPlanMock).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: true, item_key: "kylling", item_title_snapshot: "Kylling" });
  });

  test("uten menuScope beholdes dagens (legacy) lesing", async () => {
    getMenuForDateAndPlanMock.mockResolvedValue([]);

    await resolveOrderDayItemPersist({
      date: "2026-05-19",
      planTier: "BASIS",
      choiceKey: "salatboks",
      clientItemKey: null,
    });

    expect(getMenuForDateAndPlanMock).toHaveBeenCalledWith("2026-05-19", "BASIS", undefined);
  });

  test("statiske lunchCategory-items overstyrer menuDay når flere varianter", async () => {
    getMenuForDateAndPlanMock.mockResolvedValue([
      {
        category: "salat",
        mealTitle: "Bare én variant",
        items: [{ key: "solo", title: "Solo", allergens: [], isVegetarian: false, available: true }],
      },
    ]);
    getLunchCategoryStaticItemsByPlanTierMock.mockResolvedValue({
      salat: [
        { key: "skinke", title: "Skinke", allergens: [], isVegetarian: false, available: true },
        { key: "kylling", title: "Kylling", allergens: [], isVegetarian: false, available: true },
      ],
    });

    const rNone = await resolveOrderDayItemPersist({
      date: "2026-05-21",
      planTier: "BASIS",
      choiceKey: "salatboks",
      clientItemKey: null,
    });
    expect(rNone.ok).toBe(false);
    expect(rNone.ok ? null : rNone.code).toBe("ITEM_CHOICE_REQUIRED");

    const rHit = await resolveOrderDayItemPersist({
      date: "2026-05-21",
      planTier: "BASIS",
      choiceKey: "salatboks",
      clientItemKey: "kylling",
    });
    expect(rHit).toEqual({ ok: true, item_key: "kylling", item_title_snapshot: "Kylling" });
  });
});
