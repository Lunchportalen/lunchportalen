import { describe, expect, it } from "vitest";

import { mergeLunchCategoryRowsWithTemplateFallback } from "@/lib/cms/lunchCategory";
import { buildFullApplyDiff } from "@/lib/menu-generator/fullApplyDiff";
import { buildFullLocalizedWeekMenuDraft } from "@/lib/menu-generator/fullApplyDomain";
import { resolveEconomyConfigForCountry } from "@/lib/menu-generator/countryEconomyDefaults";
import { buildApplyWeekDiff } from "@/lib/menu-generator/applyWeekMenuDiff";
import { FIXED_CATEGORY_KEYS } from "@/lib/menu-generator/types";
import type { ProviderMenuCatalogSnapshot } from "@/lib/provider-menu/lunchCategoryCatalog";
import { buildMenuCatalogSnapshot } from "@/lib/provider-menu/providerMenuCatalogReadModel";
import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";
import type { ProviderOrderLockState } from "@/lib/provider-menu/providerMenuOrderLock";

const PROVIDER = "11111111-1111-1111-1111-111111111111";
const WEEK = "2031-03-31";
const DATES = ["2031-03-31", "2031-04-01", "2031-04-02", "2031-04-03", "2031-04-04"];
const EMPTY_LOCK: ProviderOrderLockState = {
  datesWithOrders: new Set(),
  lockedCatalogItemKeys: new Set(),
  orderCountsByDate: new Map(),
  queryFailed: false,
};

function melhusLikeCatalog(): ProviderMenuCatalogSnapshot {
  return {
    rows: [
      {
        key: "paasmurt",
        title: "Påsmurt",
        isProviderScoped: true,
        items: [
          { key: "ost-skinke", title: "Ost & Skinke", allergens: ["hvete", "melk"] },
          { key: "laks-eggerore", title: "Laks & Eggerøre", allergens: ["hvete", "egg", "fisk"] },
        ],
      },
      {
        key: "salatboks",
        title: "Salatboks",
        isProviderScoped: true,
        items: [{ key: "skinke", title: "Skinke", allergens: ["melk"] }],
      },
      {
        key: "sushi",
        title: "Sushi",
        isProviderScoped: true,
        items: [{ key: "sushi-pakke", title: "Sushi-pakke", allergens: ["fisk"] }],
      },
      {
        key: "pokebowl",
        title: "Pokebowl",
        isProviderScoped: true,
        items: [{ key: "laks", title: "Laks", allergens: ["fisk"] }],
      },
      {
        key: "thaimat",
        title: "Thaimat",
        isProviderScoped: true,
        items: [{ key: "pad-thai-nudler", title: "Pad Thai nudler", allergens: ["soya"] }],
      },
    ],
  };
}

function melhusCatalogAfterVegetarianApply(): ProviderMenuCatalogSnapshot {
  return {
    rows: [
      ...melhusLikeCatalog().rows,
      {
        key: "vegetarian",
        title: "Vegetar",
        isProviderScoped: true,
        items: [
          { key: "gronnsakspai", title: "Grønnsakspai", allergens: ["hvete", "melk", "egg"] },
          { key: "linsegryte", title: "Linsegryte", allergens: [] },
          { key: "vegetargryte-med-byggryn", title: "Vegetargryte med byggryn", allergens: ["hvete"] },
        ],
      },
    ],
  };
}

function strictDiff(
  catalog: ProviderMenuCatalogSnapshot,
  existingRows: ProviderMenuDayRow[] = [],
) {
  const draft = buildFullLocalizedWeekMenuDraft({
    providerId: PROVIDER,
    weekStart: WEEK,
    menuLocale: "nb-NO",
    country: "NO",
    menuProfileId: "norwegian_company_lunch",
    packageTier: "LUXUS",
    enabledCategories: FIXED_CATEGORY_KEYS,
    economyConfig: resolveEconomyConfigForCountry("NO"),
  });
  return buildFullApplyDiff({
    draft,
    existingRows,
    catalog,
    overwriteMode: "create_missing_only_strict",
    lockState: EMPTY_LOCK,
    categoryScope: "all_supported",
  });
}

function menuDayRow(
  partial: Partial<ProviderMenuDayRow> & Pick<ProviderMenuDayRow, "date" | "tier">,
): ProviderMenuDayRow {
  return {
    id: `id-${partial.tier}-${partial.date}`,
    category: "varmrett",
    mealTitle: "Pasta carbonara",
    description: "Klassisk pasta.",
    allergens: ["Gluten", "Melk", "Egg"],
    estimatedCostPerPortion: null,
    sourcePackage: null,
    upgradeType: null,
    upgradeNote: null,
    approvedForPublish: false,
    customerVisible: false,
    status: "draft",
    ...partial,
  };
}

function tierMenuDayRows(): ProviderMenuDayRow[] {
  const tiers = ["BASIS", "LUXUS", "ENTERPRISE"] as const;
  const rows: ProviderMenuDayRow[] = [];
  for (const date of DATES) {
    for (const tier of tiers) {
      rows.push(menuDayRow({ date, tier }));
    }
  }
  return rows;
}

describe("apply catalog dryRun idempotency", () => {
  it("merge marks provider-scoped rows over global templates", () => {
    const merged = mergeLunchCategoryRowsWithTemplateFallback(
      [
        { key: "vegetarian", title: "Vegetar mal", items: [] },
        { key: "paasmurt", title: "Mal", items: [{ key: "a", title: "A" }] },
      ],
      [{ key: "vegetarian", title: "Vegetar", items: [{ key: "linsegryte", title: "Linsegryte" }] }],
    );
    const snapshot = buildMenuCatalogSnapshot(merged);
    const veg = snapshot.rows.find((r) => r.key === "vegetarian");
    expect(veg?.isProviderScoped).toBe(true);
    expect(veg?.items?.[0]?.key).toBe("linsegryte");
  });

  it("before apply: vegetarian missing => would_create_category", () => {
    const diff = strictDiff(melhusLikeCatalog());
    const vegetarian = diff.catalogCategories.find((c) => c.categoryKey === "vegetarian");
    expect(vegetarian?.status).toBe("would_create_category");
    expect(diff.summary.updatedCategories).toBe(0);
  });

  it("after apply: provider-scoped vegetarian => skipped_existing_category, not would_create", () => {
    const diff = strictDiff(melhusCatalogAfterVegetarianApply(), tierMenuDayRows());
    const vegetarian = diff.catalogCategories.find((c) => c.categoryKey === "vegetarian");
    expect(vegetarian?.status).toBe("would_skip_existing_category");
    expect(vegetarian?.status).not.toBe("would_create_category");
    expect(diff.summary.createdDraftDays).toBe(0);
    expect(diff.summary.updatedCategories).toBe(0);
    expect(diff.catalogCategories.every((c) => c.status !== "would_update_category")).toBe(true);
  });

  it("after apply: provider-scoped vegetarian with empty items still skips in strict mode", () => {
    const catalog: ProviderMenuCatalogSnapshot = {
      rows: [
        ...melhusLikeCatalog().rows,
        { key: "vegetarian", title: "Vegetar", isProviderScoped: true, items: [] },
      ],
    };
    const diff = strictDiff(catalog, tierMenuDayRows());
    const vegetarian = diff.catalogCategories.find((c) => c.categoryKey === "vegetarian");
    expect(vegetarian?.status).toBe("would_skip_existing_category");
  });

  it("strict mode skips all existing provider catalog categories including vegetarian", () => {
    const diff = strictDiff(melhusCatalogAfterVegetarianApply(), tierMenuDayRows());
    for (const key of ["sandwich", "salad", "sushi", "poke", "asian", "vegetarian"] as const) {
      const row = diff.catalogCategories.find((c) => c.categoryKey === key);
      expect(row?.status).toBe("would_skip_existing_category");
    }
  });

  it("varmrett apply model uses 5 unique weekdays and 15 tier docs", () => {
    const existing = tierMenuDayRows();
    expect(new Set(existing.map((r) => r.date)).size).toBe(5);
    expect(existing.length).toBe(15);
    expect(existing.every((r) => r.approvedForPublish === false && r.customerVisible === false)).toBe(true);

    const draft = buildFullLocalizedWeekMenuDraft({
      providerId: PROVIDER,
      weekStart: WEEK,
      menuLocale: "nb-NO",
      country: "NO",
      menuProfileId: "norwegian_company_lunch",
      packageTier: "LUXUS",
      enabledCategories: FIXED_CATEGORY_KEYS,
      economyConfig: resolveEconomyConfigForCountry("NO"),
    });
    const varmrettByDate = new Map(
      draft.days.map((day) => {
        const hot = day.categories.find((c) => c.categoryKey === "hotMeal")?.items[0];
        return [
          day.date,
          hot
            ? {
                mealTitle: hot.title,
                description: hot.description,
                allergensText: hot.allergens.join(", "),
                itemKey: hot.itemKey,
                slug: hot.sourceDishSlug,
              }
            : null,
        ] as const;
      }).filter(([, v]) => v != null),
    );

    const varmrettDiff = buildApplyWeekDiff({
      weekStart: WEEK,
      dates: DATES,
      existingRows: existing,
      varmrettByDate: varmrettByDate as never,
      overwriteMode: "create_missing_only_strict",
      dryRun: true,
      lockState: EMPTY_LOCK,
    });

    expect(varmrettDiff.days.every((d) => d.status === "skipped_existing")).toBe(true);
    expect(varmrettDiff.days.filter((d) => d.status === "would_create")).toHaveLength(0);
  });
});
