import { describe, expect, it, vi } from "vitest";

import { loadEmployeeWeekMenusFromMsdi } from "@/lib/week/loadEmployeeWeekMenusFromMsdi";

function makeDb(msdRows: unknown[], msdiRows: unknown[]) {
  return {
    from: (table: string) => {
      if (table === "menu_service_days") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    in: async () => ({ data: msdRows, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "menu_service_day_items") {
        return {
          select: () => ({
            in: async () => ({ data: msdiRows, error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("loadEmployeeWeekMenusFromMsdi", () => {
  it("returnerer publisert rett for provider-scoped MSDI", async () => {
    const map = await loadEmployeeWeekMenusFromMsdi(makeDb(
      [{ id: "msd-1", service_date: "2026-06-15", state: "published" }],
      [{
        menu_service_day_id: "msd-1",
        product_id: "prod-1",
        product_name_snapshot: "Testrett første ordre",
        products: { sku: "varmrett" },
      }],
    ), {
      companyId: "8b0b8fa4-8d89-4795-b92b-e09129dd635f",
      locationId: "f319b299-8914-4c52-9984-569ce07c914d",
      providerId: "11111111-1111-1111-1111-111111111111",
      dates: ["2026-06-15"],
      tierByDate: new Map([["2026-06-15", "BASIS"]]),
    });

    const menus = map.get("2026-06-15");
    expect(menus?.length).toBe(1);
    expect(menus?.[0]?.isPublished).toBe(true);
    expect(menus?.[0]?.title).toBe("Testrett første ordre");
    expect(menus?.[0]?.category).toBe("varmrett");
  });

  it("returnerer tom map uten location (fail-closed)", async () => {
    const map = await loadEmployeeWeekMenusFromMsdi(makeDb([], []), {
      companyId: "8b0b8fa4-8d89-4795-b92b-e09129dd635f",
      locationId: null,
      providerId: "11111111-1111-1111-1111-111111111111",
      dates: ["2026-06-15"],
      tierByDate: new Map(),
    });
    expect(map.size).toBe(0);
  });
});

describe("varmrett category vs varmmat choice key", () => {
  it("menuDay category varmrett maps ikke til choice_key varmrett", async () => {
    const { ORDER_CHOICE_KEY_BY_CATEGORY } = await import("@/lib/cms/menuDayContract");
    expect(ORDER_CHOICE_KEY_BY_CATEGORY.varmrett).toBe("varmmat");
    expect(ORDER_CHOICE_KEY_BY_CATEGORY.varmrett).not.toBe("varmrett");
  });
});
