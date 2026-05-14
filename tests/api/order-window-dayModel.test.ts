import { describe, expect, test } from "vitest";
import { buildDayModel, buildLegacyChoiceCategories, buildMenuDayCategories } from "@/app/api/order/window/route";

describe("order/window – buildDayModel", () => {
  test("returns locked by cutoff when past", () => {
    const date = "2024-01-01";

    const day = buildDayModel({
      date,
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
      deliveryDays: ["mon", "tue", "wed", "thu", "fri"],
      dayTiers: { mon: "BASIS" } as any,
      ordersByDate: new Map(),
      dayChoicesByDate: new Map(),
      agreementForChoices: {
        choicesByTier: {
          BASIS: [{ key: "salatboks" }],
        },
      },
      mealContract: null,
      menuByMealType: new Map(),
      productPlans: { BASIS: null, LUXUS: null },
    } as any);

    expect(day.date).toBe(date);
    expect(day.weekday).toBe("mon");
    expect(day.isEnabled).toBe(true);
  });

  test("filters selectedChoiceKey to allowed choices", () => {
    const date = "2026-02-02"; // Monday
    const ordersByDate = new Map([
      [
        date,
        {
          date,
          status: "active",
          note: "choice:salatboks",
          updated_at: null,
          created_at: null,
          slot: "lunch",
          location_id: "l1",
          company_id: "c1",
          user_id: "u1",
        },
      ],
    ] as any);

    const day = buildDayModel({
      date,
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
      deliveryDays: ["mon"],
      dayTiers: { mon: "BASIS" } as any,
      ordersByDate,
      dayChoicesByDate: new Map(),
      agreementForChoices: {
        choicesByTier: {
          BASIS: [{ key: "salatboks" }],
        },
      },
      mealContract: null,
      menuByMealType: new Map(),
      productPlans: { BASIS: null, LUXUS: null },
    } as any);

    expect(day.wantsLunch).toBe(true);
    expect(day.selectedChoiceKey).toBe("salatboks");
    expect(day.allowedChoices.some((c) => c.key === "salatboks")).toBe(true);
  });

  test("operative closed_dates blokkerer bestillbarhet uten å fjerne menykontekst (agreementDayOk)", () => {
    const date = "2030-06-04";
    const operativeClosedReasonByDate = new Map<string, string>([[date, "Planlagt stengt"]]);

    const day = buildDayModel({
      date,
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
      deliveryDays: ["tue"],
      dayTiers: { tue: "BASIS" } as any,
      ordersByDate: new Map(),
      dayChoicesByDate: new Map(),
      agreementForChoices: {
        choicesByTier: {
          BASIS: [{ key: "varmmat" }],
        },
      },
      mealContract: null,
      menuByMealType: new Map(),
      productPlans: { BASIS: null, LUXUS: null },
      operativeClosedReasonByDate,
    } as any);

    expect(day.isEnabled).toBe(false);
    expect(day.isLocked).toBe(true);
    expect(day.lockReason).toBe("CLOSED_DATE");
    expect(day.allowedChoices.length).toBeGreaterThan(0);
  });

  test("BASIS menuDay categories map to order-safe choice keys", () => {
    const categories = buildMenuDayCategories({
      planTier: "BASIS",
      menus: [
        { category: "paasmurt", mealTitle: "Rundstykke", description: "Med ost", allergens: ["melk"] },
        { category: "salat", mealTitle: "Kyllingsalat", description: null, allergens: [] },
        { category: "varmrett", mealTitle: "Lasagne", description: "Varm", allergens: ["gluten"] },
      ],
    });

    expect(categories).toHaveLength(3);
    expect(categories.map((c) => c.key)).toEqual(["paasmurt", "salatboks", "varmmat"]);
    expect(categories.map((c) => c.available)).toEqual([true, true, true]);
  });

  test("LUXUS and ENTERPRISE expose six plan categories", () => {
    const luxus = buildMenuDayCategories({ planTier: "LUXUS", menus: [] });
    const enterprise = buildMenuDayCategories({ planTier: "ENTERPRISE", menus: [] });

    expect(luxus).toHaveLength(6);
    expect(enterprise).toHaveLength(6);
    expect(luxus.every((c) => c.available === false)).toBe(true);
  });

  test("tier null gir eksplisitt NO_TIER_FOR_DAY reason uten å endre låselogikk", () => {
    const date = "2030-06-03";
    const day = buildDayModel({
      date,
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
      deliveryDays: ["mon"],
      dayTiers: { mon: null } as any,
      ordersByDate: new Map(),
      dayChoicesByDate: new Map(),
      agreementForChoices: null,
      mealContract: null,
      menuByMealType: new Map(),
      productPlans: { BASIS: null, LUXUS: null },
    } as any);

    expect(day.tier).toBeNull();
    expect(day.reason).toBe("NO_TIER_FOR_DAY");
    expect(day.isEnabled).toBe(false);
  });

  test("legacy fallback categories preserve existing meal-type choices", () => {
    const categories = buildLegacyChoiceCategories(
      [
        { key: "salatboks", label: "Salat" },
        { key: "varmmat", label: "Varmrett" },
      ],
      true,
    );

    expect(categories.map((c) => ({ key: c.key, label: c.label, available: c.available }))).toEqual([
      { key: "salatboks", label: "Salat", available: true },
      { key: "varmmat", label: "Varmrett", available: true },
    ]);
  });
});

