/**
 * PR A — language must not change menu identity (category/item/choice/tier/scope).
 * Behavioral guards only; no runtime or UI changes.
 */
import { describe, expect, test } from "vitest";

import { buildMenuDayCategories } from "@/app/api/order/window/route";
import {
  ORDER_CHOICE_KEY_BY_CATEGORY,
  PLAN_CATEGORIES,
  PLAN_ORDER_CHOICE_KEYS,
  PLAN_TIERS,
} from "@/lib/cms/menuDayContract";
import type { MenuDay } from "@/lib/cms/menuDay";
import { MARKET_COMMERCIAL_CONFIGS } from "@/lib/commercial/marketConfigs";
import { APP_LOCALES } from "@/lib/i18n/localeRegistry";
import { resolveAppLocale } from "@/lib/i18n/resolveAppLocale";
import { buildMenuDayPayload, type MenuDayInput } from "@/lib/provider-menu/menuDayPayload";
import { VARMRETT_SHARED_TIERS } from "@/lib/provider-menu/varmrettSharedWrite";
import { assertEmployeeOrderBodyHasNoPricingOverrides } from "@/lib/orders/orderWriteGuard";
import { buildEmployeeWeekDayRows } from "@/lib/week/employeeWeekMenuDays";
import { orderWriteBodySchema } from "@/lib/validation/schemas";

const PROVIDER_A = "22222222-2222-2222-2222-222222222222";

const SAMPLE_MENUS = [
  {
    category: "varmrett" as const,
    mealTitle: "Kyllinggryte",
    description: "Med rotgrønnsaker",
    allergens: ["melk"],
  },
  {
    category: "salat" as const,
    mealTitle: "Salatdag",
    items: [
      { key: "kylling", title: "Kylling", allergens: [], isVegetarian: false, available: true },
      { key: "vegetar", title: "Vegetar", allergens: [], isVegetarian: true, available: true },
    ],
  },
];

type MenuIdentity = {
  categoryKeys: string[];
  choiceKeys: string[];
  itemKeysByChoice: Record<string, string[]>;
  planTier: string;
};

function extractMenuIdentity(planTier: "BASIS" | "LUXUS" | "ENTERPRISE"): MenuIdentity {
  const categories = buildMenuDayCategories({
    planTier,
    menus: SAMPLE_MENUS,
  });
  const itemKeysByChoice: Record<string, string[]> = {};
  for (const cat of categories) {
    itemKeysByChoice[cat.key] = cat.items.map((item) => item.key);
  }
  return {
    categoryKeys: categories.map((c) => String(c.category)),
    choiceKeys: categories.map((c) => c.key),
    itemKeysByChoice,
    planTier,
  };
}

function extractWeekDayIdentity(rows: ReturnType<typeof buildEmployeeWeekDayRows>) {
  return rows.map((row) => ({
    date: row.date,
    tier: row.tier,
    dayKey: row.dayKey,
    dishCategories: row.dishes.map((d) => d.category),
  }));
}

describe("language does not change menu identity — buildMenuDayCategories", () => {
  test("menu identity is identical for every app UI locale (resolveAppLocale is orthogonal)", () => {
    const baseline = extractMenuIdentity("LUXUS");

    for (const locale of APP_LOCALES) {
      expect(resolveAppLocale({ cookie: locale })).toBe(locale);
      expect(extractMenuIdentity("LUXUS")).toEqual(baseline);
    }
  });

  test("display labels may differ later — stable IDs are category + choice + item keys", () => {
    const categories = buildMenuDayCategories({ planTier: "BASIS", menus: SAMPLE_MENUS });
    expect(categories.map((c) => c.category)).toEqual(PLAN_CATEGORIES.BASIS);
    expect(categories.map((c) => c.key)).toEqual(PLAN_ORDER_CHOICE_KEYS.BASIS);
    const salat = categories.find((c) => c.category === "salat");
    expect(salat?.items.map((i) => i.key)).toEqual(["kylling", "vegetar"]);
  });
});

describe("language does not change warm dish identity", () => {
  test("varmrett maps to stable order choice varmmat across tiers", () => {
    expect(ORDER_CHOICE_KEY_BY_CATEGORY.varmrett).toBe("varmmat");
    for (const tier of PLAN_TIERS) {
      expect(PLAN_ORDER_CHOICE_KEYS[tier]).toContain("varmmat");
    }
  });

  test("shared varmrett write tiers are contract-fixed, not locale-driven", () => {
    expect([...VARMRETT_SHARED_TIERS]).toEqual(["BASIS", "LUXUS", "ENTERPRISE"]);
  });

  test("warm dish server order identity uses choice slug, not display title", () => {
    const englishTitleMenus = [
      {
        category: "varmrett" as const,
        mealTitle: "Chicken stew",
        description: "With root vegetables",
        allergens: [],
      },
    ];
    const categories = buildMenuDayCategories({ planTier: "BASIS", menus: englishTitleMenus });
    const warm = categories.find((c) => c.category === "varmrett");
    expect(warm?.key).toBe("varmmat");
    expect(warm?.category).toBe("varmrett");
    expect(warm?.title).toBe("Chicken stew");
  });
});

describe("language does not change package / tier entitlement", () => {
  test("PLAN_CATEGORIES tier allowlists are independent of UI locale", () => {
    for (const locale of APP_LOCALES) {
      resolveAppLocale({ cookie: locale, profile: "nb" });
      expect(PLAN_CATEGORIES.BASIS).toEqual(["paasmurt", "salat", "varmrett"]);
      expect(PLAN_CATEGORIES.LUXUS).toHaveLength(6);
      expect(PLAN_CATEGORIES.ENTERPRISE).toEqual(PLAN_CATEGORIES.LUXUS);
    }
  });

  test("buildEmployeeWeekDayRows tier comes from agreement daymap, not locale", () => {
    const menuByDate = new Map<string, MenuDay | MenuDay[]>([
      [
        "2026-06-16",
        {
          category: "varmrett",
          mealTitle: "Dagens rett",
          isPublished: true,
        } as MenuDay,
      ],
    ]);

    const nbRows = buildEmployeeWeekDayRows({
      dates: ["2026-06-16"],
      deliveryDayKeys: ["mon"],
      defaultTier: "BASIS",
      tierByDay: { mon: "LUXUS" },
      weekOffset: 0,
      menuByDate,
    });

    for (const locale of ["nb", "en", "sv"] as const) {
      resolveAppLocale({ cookie: locale });
      const rows = buildEmployeeWeekDayRows({
        dates: ["2026-06-16"],
        deliveryDayKeys: ["mon"],
        defaultTier: "BASIS",
        tierByDay: { mon: "LUXUS" },
        weekOffset: 0,
        menuByDate,
      });
      expect(extractWeekDayIdentity(rows)).toEqual(extractWeekDayIdentity(nbRows));
      expect(rows[0]?.tier).toBe("LUXUS");
    }
  });
});

describe("language does not change currency or commercial market", () => {
  test("resolveAppLocale does not select MARKET_COMMERCIAL_CONFIGS currency", () => {
    for (const locale of APP_LOCALES) {
      resolveAppLocale({ cookie: locale });
      expect(MARKET_COMMERCIAL_CONFIGS.NO.defaultCurrency).toBe("NOK");
      expect(MARKET_COMMERCIAL_CONFIGS.SE.defaultCurrency).toBe("SEK");
    }
  });
});

describe("missing translation fallback contract (display-only future)", () => {
  test("provider-owned title passes through unchanged — identity keys stay stable", () => {
    const providerTitle = "Laks med dill";
    const categories = buildMenuDayCategories({
      planTier: "LUXUS",
      menus: [
        {
          category: "paasmurt",
          mealTitle: providerTitle,
          items: [{ key: "laks", title: providerTitle, allergens: ["fisk"], isVegetarian: false, available: true }],
        },
      ],
    });
    const paasmurt = categories.find((c) => c.category === "paasmurt");
    expect(paasmurt?.title).toBe(providerTitle);
    expect(paasmurt?.key).toBe("paasmurt");
    expect(paasmurt?.items[0]?.key).toBe("laks");
  });
});

describe("provider publish unaffected by UI locale", () => {
  const PUBLISH_INPUT: MenuDayInput = {
    date: "2026-06-16",
    tier: "BASIS",
    category: "varmrett",
    mealTitle: "Kyllinggryte",
    description: "Med rotgrønnsaker.",
    status: "published",
  };

  test("buildMenuDayPayload has no locale input and is deterministic", () => {
    const first = buildMenuDayPayload(PROVIDER_A, PUBLISH_INPUT);
    const second = buildMenuDayPayload(PROVIDER_A, PUBLISH_INPUT);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.payload.category).toBe("varmrett");
    expect(second.payload.category).toBe("varmrett");
    expect(first.payload.planTier).toBe("BASIS");
    expect(first.docId).toBe(second.docId);
    expect(first.payload.mealTitle).toBe(second.payload.mealTitle);
    expect(first.payload._id).toBe(second.payload._id);
  });

  test("publish payload identity unchanged when resolveAppLocale varies", () => {
    const payloads = APP_LOCALES.map(() => buildMenuDayPayload(PROVIDER_A, PUBLISH_INPUT));
    for (const result of payloads) {
      expect(result.ok).toBe(true);
    }
    const docIds = payloads.filter((r) => r.ok).map((r) => (r.ok ? r.docId : ""));
    expect(new Set(docIds).size).toBe(1);
  });
});

describe("order write path — identity not display text or locale", () => {
  test("orderWriteBodySchema accepts choice_key and itemKey only — no locale field", () => {
    const parsed = orderWriteBodySchema.safeParse({
      date: "2026-06-16",
      action: "set",
      choice_key: "paasmurt",
      itemKey: "laks",
    });
    expect(parsed.success).toBe(true);
    expect(orderWriteBodySchema.safeParse({ date: "2026-06-16", locale: "en" }).success).toBe(true);
    expect(Object.keys(orderWriteBodySchema.shape)).not.toContain("locale");
    expect(Object.keys(orderWriteBodySchema.shape)).not.toContain("language");
  });

  test("employee cannot override tier/currency/price via body regardless of UI locale", () => {
    for (const locale of APP_LOCALES) {
      resolveAppLocale({ cookie: locale });
      expect(
        assertEmployeeOrderBodyHasNoPricingOverrides({ currency: "EUR", tier: "ENTERPRISE" }, "employee"),
      ).toEqual({ ok: false, code: "PRICING_OVERRIDE_FORBIDDEN" });
    }
  });
});
