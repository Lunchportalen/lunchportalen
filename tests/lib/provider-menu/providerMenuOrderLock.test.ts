import { describe, expect, test } from "vitest";

import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import {
  assertCatalogWriteAllowed,
  assertVarmrettContentChangeAllowed,
  applyOrderLocksToCatalog,
  isCatalogItemLocked,
  isVarmrettDateLocked,
  lunchCategoryKeyFromChoiceKey,
  ProviderMenuOrderLockError,
  type ProviderOrderLockState,
} from "@/lib/provider-menu/providerMenuOrderLock";
import type { MenuCatalogWriteInput } from "@/lib/provider-menu/menuCatalogWrite";
import { osloTodayISODate } from "@/lib/date/oslo";

function lockState(
  partial: Partial<ProviderOrderLockState> & Pick<ProviderOrderLockState, "queryFailed">,
): ProviderOrderLockState {
  return {
    datesWithOrders: partial.datesWithOrders ?? new Set(),
    lockedCatalogItemKeys: partial.lockedCatalogItemKeys ?? new Set(),
    queryFailed: partial.queryFailed,
  };
}

describe("providerMenuOrderLock", () => {
  test("lunchCategoryKeyFromChoiceKey maps salat and thai aliases", () => {
    expect(lunchCategoryKeyFromChoiceKey("salat")).toBe("salatboks");
    expect(lunchCategoryKeyFromChoiceKey("thaimat")).toBe("thaimat");
    expect(lunchCategoryKeyFromChoiceKey("paasmurt")).toBe("paasmurt");
  });

  test("isCatalogItemLocked follows locked keys", () => {
    const state = lockState({
      queryFailed: false,
      lockedCatalogItemKeys: new Set(["paasmurt::laks"]),
    });
    expect(isCatalogItemLocked(state, "paasmurt", "laks")).toBe(true);
    expect(isCatalogItemLocked(state, "paasmurt", "kylling")).toBe(false);
  });

  test("fail-closed query marks catalog items locked", () => {
    const state = lockState({ queryFailed: true });
    expect(isCatalogItemLocked(state, "paasmurt", "laks")).toBe(true);
  });

  test("isVarmrettDateLocked uses datesWithOrders", () => {
    const today = osloTodayISODate();
    const state = lockState({
      queryFailed: false,
      datesWithOrders: new Set([today]),
    });
    expect(isVarmrettDateLocked(state, today)).toBe(true);
    expect(isVarmrettDateLocked(state, "2099-01-01")).toBe(false);
  });

  test("fail-closed varmrett locks future dates", () => {
    const today = osloTodayISODate();
    const state = lockState({ queryFailed: true });
    expect(isVarmrettDateLocked(state, today)).toBe(true);
    expect(isVarmrettDateLocked(state, "2000-01-01")).toBe(false);
  });

  test("assertCatalogWriteAllowed allows ADD (new key)", () => {
    const existing = new Map<string, Record<string, unknown>>([
      ["laks", { title: "Laks", description: "", allergens: [], isVegetarian: false }],
    ]);
    const state = lockState({
      queryFailed: false,
      lockedCatalogItemKeys: new Set(["paasmurt::laks"]),
    });
    const input: MenuCatalogWriteInput = {
      categoryKey: "paasmurt",
      items: [
        { key: "laks", title: "Laks", allergens: [], isVegetarian: false },
        { title: "Ny rett", allergens: [], isVegetarian: false },
      ],
    };
    expect(() => assertCatalogWriteAllowed(state, "paasmurt", existing, input)).not.toThrow();
  });

  test("assertCatalogWriteAllowed rejects remove of locked item", () => {
    const existing = new Map<string, Record<string, unknown>>([
      ["laks", { title: "Laks", description: "", allergens: [], isVegetarian: false }],
    ]);
    const state = lockState({
      queryFailed: false,
      lockedCatalogItemKeys: new Set(["paasmurt::laks"]),
    });
    const input: MenuCatalogWriteInput = {
      categoryKey: "paasmurt",
      items: [{ key: "kylling", title: "Kylling", allergens: [], isVegetarian: false }],
    };
    expect(() => assertCatalogWriteAllowed(state, "paasmurt", existing, input)).toThrow(
      ProviderMenuOrderLockError,
    );
  });

  test("assertCatalogWriteAllowed rejects title change on locked item", () => {
    const existing = new Map<string, Record<string, unknown>>([
      ["laks", { title: "Laks", description: "", allergens: [], isVegetarian: false }],
    ]);
    const state = lockState({
      queryFailed: false,
      lockedCatalogItemKeys: new Set(["paasmurt::laks"]),
    });
    const input: MenuCatalogWriteInput = {
      categoryKey: "paasmurt",
      items: [{ key: "laks", title: "Marinert laks", allergens: [], isVegetarian: false }],
    };
    expect(() => assertCatalogWriteAllowed(state, "paasmurt", existing, input)).toThrow(
      ProviderMenuOrderLockError,
    );
  });

  test("assertVarmrettContentChangeAllowed allows identical content on locked date", () => {
    const today = osloTodayISODate();
    const state = lockState({ queryFailed: false, datesWithOrders: new Set([today]) });
    const before = {
      mealTitle: "Kylling",
      description: "Med ris",
      allergensText: "",
      estimatedCostPerPortion: null,
    };
    expect(() => assertVarmrettContentChangeAllowed(state, today, before, { ...before })).not.toThrow();
  });

  test("assertVarmrettContentChangeAllowed rejects content change on locked date", () => {
    const today = osloTodayISODate();
    const state = lockState({ queryFailed: false, datesWithOrders: new Set([today]) });
    expect(() =>
      assertVarmrettContentChangeAllowed(
        state,
        today,
        { mealTitle: "Kylling", description: "Med ris", allergensText: "", estimatedCostPerPortion: null },
        { mealTitle: "Laks", description: "Med ris", allergensText: "", estimatedCostPerPortion: null },
      ),
    ).toThrow(ProviderMenuOrderLockError);
  });

  test("applyOrderLocksToCatalog sets orderLocked on items", () => {
    const catalog: ProviderMenuCatalogSnapshot = {
      rows: [
        {
          key: "paasmurt",
          items: [
            { key: "laks", title: "Laks" },
            { key: "kylling", title: "Kylling" },
          ],
        },
      ],
    };
    const state = lockState({
      queryFailed: false,
      lockedCatalogItemKeys: new Set(["paasmurt::laks"]),
    });
    const out = applyOrderLocksToCatalog(catalog, state);
    expect(out.rows[0]?.items?.[0]?.orderLocked).toBe(true);
    expect(out.rows[0]?.items?.[1]?.orderLocked).toBe(false);
  });
});
