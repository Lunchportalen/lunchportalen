import { describe, expect, test } from "vitest";
import { buildDayModel } from "@/app/api/order/window/route";

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
          BASIS: [{ key: "salatbar" }],
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
          note: "choice:salatbar",
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
          BASIS: [{ key: "salatbar" }],
        },
      },
      mealContract: null,
      menuByMealType: new Map(),
      productPlans: { BASIS: null, LUXUS: null },
    } as any);

    expect(day.wantsLunch).toBe(true);
    expect(day.selectedChoiceKey).toBe("salatbar");
    expect(day.allowedChoices.some((c) => c.key === "salatbar")).toBe(true);
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
});

