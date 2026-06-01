import { describe, expect, test } from "vitest";
import { buildDayModel } from "@/app/api/order/window/route";
import {
  foldOrdersByDate,
  shouldPreferCanonicalOrderRow,
} from "@/lib/orders/pickCanonicalOrderPerDate";

const DATE = "2026-06-02";

const cancelledOlder = {
  id: "4704a693-0000-4000-8000-000000000001",
  date: DATE,
  status: "CANCELLED",
  updated_at: "2026-06-01T09:35:00.000Z",
  created_at: "2026-06-01T09:34:00.000Z",
  note: null,
  slot: "default",
  location_id: "l1",
  company_id: "c1",
  user_id: "u1",
};

const activeNewer = {
  id: "ec35331c-0000-4000-8000-000000000002",
  date: DATE,
  status: "ACTIVE",
  updated_at: "2026-06-01T11:19:00.000Z",
  created_at: "2026-06-01T11:19:00.000Z",
  note: null,
  slot: "default",
  location_id: "l1",
  company_id: "c1",
  user_id: "u1",
};

describe("pickCanonicalOrderPerDate — prod cancel-then-reorder", () => {
  test("last-wins without precedence: CANCELLED after ACTIVE loses (regression)", () => {
    const naive = new Map<string, (typeof cancelledOlder)>();
    for (const row of [activeNewer, cancelledOlder]) {
      naive.set(DATE, row);
    }
    expect(naive.get(DATE)?.status).toBe("CANCELLED");
  });

  test("foldOrdersByDate: CANCELLED after ACTIVE still picks ACTIVE", () => {
    const map = foldOrdersByDate([activeNewer, cancelledOlder], (r) => String(r.date));
    expect(map.get(DATE)?.status).toBe("ACTIVE");
    expect(map.get(DATE)?.id).toBe(activeNewer.id);
  });

  test("foldOrdersByDate: ACTIVE after CANCELLED picks ACTIVE (arbitrary order)", () => {
    const map = foldOrdersByDate([cancelledOlder, activeNewer], (r) => String(r.date));
    expect(map.get(DATE)?.status).toBe("ACTIVE");
    expect(map.get(DATE)?.id).toBe(activeNewer.id);
  });

  test("shouldPreferCanonicalOrderRow: ACTIVE beats newer CANCELLED", () => {
    const newerCancelled = {
      ...cancelledOlder,
      updated_at: "2026-06-01T12:00:00.000Z",
    };
    expect(shouldPreferCanonicalOrderRow(activeNewer, newerCancelled)).toBe(true);
    expect(shouldPreferCanonicalOrderRow(newerCancelled, activeNewer)).toBe(false);
  });

  test("buildDayModel + fold: wantsLunch and selectedChoiceKey from ACTIVE + day_choices", () => {
    const ordersByDate = foldOrdersByDate([cancelledOlder, activeNewer], (r) => String(r.date));
    const dayChoicesByDate = new Map([
      [
        DATE,
        {
          date: DATE,
          choice_key: "salatboks",
          item_key: "skinke",
          item_title_snapshot: null,
          note: null,
          status: "ACTIVE",
          updated_at: "2026-06-01T11:19:00.000Z",
        },
      ],
    ] as any);

    const day = buildDayModel({
      date: DATE,
      company: {
        id: "c1",
        name: "Test",
        status: "ACTIVE",
        canEditOrders: true,
        lockReason: null,
        paused_reason: null,
        closed_reason: null,
      },
      agreementUsable: true,
      deliveryDays: ["mon", "tue"],
      dayTiers: { tue: "BASIS" } as any,
      ordersByDate,
      dayChoicesByDate,
      agreementForChoices: {
        choicesByTier: {
          BASIS: [{ key: "salatboks" }],
        },
      },
      mealContract: null,
      menuByMealType: new Map(),
      productPlans: { BASIS: null, LUXUS: null },
    } as any);

    expect(day.orderStatus).toBe("ACTIVE");
    expect(day.wantsLunch).toBe(true);
    expect(day.selectedChoiceKey).toBe("salatboks");
    expect(day.selectedItemKey).toBe("skinke");
  });
});
