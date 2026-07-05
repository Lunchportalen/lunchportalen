import { describe, expect, it } from "vitest";

import { resolveMenuApplyCapabilities } from "@/lib/menu-generator/applyCapabilities";
import { buildApplyIdempotencyKey, isSupportedApplyMenuLocale } from "@/lib/menu-generator/applyTypes";
import { formatAllergensForCatalog, formatAllergensForMenuDay } from "@/lib/menu-generator/allergenMenuDayFormat";
import { buildApplyWeekDiff, wouldMutateInDryRun } from "@/lib/menu-generator/applyWeekMenuDiff";
import { buildFullLocalizedWeekMenuDraft } from "@/lib/menu-generator/fullApplyDomain";
import { buildFullApplyDiff, fullApplyWouldMutate } from "@/lib/menu-generator/fullApplyDiff";
import { enterpriseHotMealIdentityStable } from "@/lib/menu-generator/applyWeekMenuMapper";
import { resolveEconomyConfigForCountry } from "@/lib/menu-generator/countryEconomyDefaults";
import type { MenuLocale } from "@/lib/menu-generator/types";
import { FIXED_CATEGORY_KEYS } from "@/lib/menu-generator/types";
import { getLocalizedCategoryLabel } from "@/lib/menu-generator/localizedCategoryLabels";
import { EMPTY_PROVIDER_MENU_CATALOG } from "@/lib/provider-menu/lunchCategoryCatalog";
import type { ProviderMenuDayRow } from "@/lib/provider-menu/loadProviderMenuDays";
import type { ProviderOrderLockState } from "@/lib/provider-menu/providerMenuOrderLock";

const PROVIDER = "11111111-1111-1111-1111-111111111111";
const WEEK = "2031-02-03";
const DATES = ["2031-02-03", "2031-02-04", "2031-02-05", "2031-02-06", "2031-02-07"];
const EMPTY_LOCK: ProviderOrderLockState = {
  datesWithOrders: new Set(),
  lockedCatalogItemKeys: new Set(),
  orderCountsByDate: new Map(),
  queryFailed: false,
};

function economy(country: string) {
  return resolveEconomyConfigForCountry(country);
}

function buildDraft(locale: string, profileId: string, country: string) {
  return buildFullLocalizedWeekMenuDraft({
    providerId: PROVIDER,
    weekStart: WEEK,
    menuLocale: locale as "nb-NO",
    country,
    menuProfileId: profileId as "norwegian_company_lunch",
    packageTier: "LUXUS",
    enabledCategories: FIXED_CATEGORY_KEYS,
    economyConfig: economy(country),
  });
}

function fullDiff(locale: string, profileId: string, country: string, existing: ProviderMenuDayRow[] = []) {
  const draft = buildDraft(locale, profileId, country);
  return buildFullApplyDiff({
    draft,
    existingRows: existing,
    catalog: EMPTY_PROVIDER_MENU_CATALOG,
    overwriteMode: "create_missing_only",
    lockState: EMPTY_LOCK,
    categoryScope: "all_supported",
  });
}

describe("full localized week menu apply", () => {
  it("capability resolver marks all 8 categories supported", () => {
    const caps = resolveMenuApplyCapabilities();
    expect(caps.supportedCategories).toContain("sandwich");
    expect(caps.supportedCategories).toContain("hotMeal");
    expect(caps.supportedCategories).toContain("vegetarian");
    expect(caps.unsupportedCategories).toHaveLength(0);
    expect(caps.canApplyFullMenu).toBe(true);
    expect(caps.categories.vegetarian.writeTarget).toBe("lunchCategory");
    expect(caps.categories.vegetarian.lunchCategoryKey).toBe("vegetarian");
  });

  it("builds idempotency key with categoryScope", () => {
    const key = buildApplyIdempotencyKey({
      providerId: PROVIDER,
      weekStart: WEEK,
      menuLocale: "nb-NO",
      menuProfileId: "norwegian_company_lunch",
      overwriteMode: "stop_if_published_exists",
      categoryScope: "all_supported",
      packageTier: "LUXUS",
    });
    expect(key).toContain("all_supported");
  });

  it("full dryRun includes catalog categories and varmrett days", () => {
    const diff = fullDiff("nb-NO", "norwegian_company_lunch", "NO");
    expect(diff.summary.totalGeneratedDays).toBe(5);
    expect(diff.catalogCategories.length).toBeGreaterThan(0);
    expect(diff.catalogCategories.some((c) => c.categoryKey === "sandwich")).toBe(true);
    expect(diff.summary.createdDraftDays).toBe(5);
    expect(fullApplyWouldMutate(diff)).toBe(true);
  });

  it("vegetarian is included in full dryRun as supported catalog category", () => {
    const diff = fullDiff("nb-NO", "norwegian_company_lunch", "NO");
    const veg = diff.catalogCategories.find((c) => c.categoryKey === "vegetarian");
    expect(veg?.status).not.toBe("blocked_schema_unsupported");
    expect(veg?.displayName).toBe("Vegetar");
    expect(diff.summary.unsupportedCategories).toBe(0);
  });

  it("varmrett-only path still works for hotMeal days", () => {
    const draft = buildDraft("nb-NO", "norwegian_company_lunch", "NO");
    const hotByDate = new Map<string, import("@/lib/menu-generator/applyWeekMenuDiff").ApplyGeneratedVarmrettState>();
    for (const d of draft.days) {
      const hot = d.categories.find((c) => c.categoryKey === "hotMeal")?.items[0];
      if (!hot) continue;
      hotByDate.set(d.date, {
        mealTitle: hot.title,
        description: hot.description,
        allergensText: hot.allergens.join(", "),
        itemKey: hot.itemKey,
        slug: hot.sourceDishSlug,
        hotMealBaseItemKey: hot.enterpriseUpgradeBaseItemKey,
        isPremiumUpgrade: hot.isPremiumUpgrade,
      });
    }
    const { days } = buildApplyWeekDiff({
      weekStart: WEEK,
      dates: DATES,
      existingRows: [],
      varmrettByDate: hotByDate,
      overwriteMode: "create_missing_only",
      dryRun: true,
      lockState: EMPTY_LOCK,
    });
    expect(days.every((d) => d.status === "would_create")).toBe(true);
    expect(wouldMutateInDryRun(days)).toBe(true);
  });

  it("de-DE has no Norwegian category labels in draft", () => {
    const draft = buildDraft("de-DE", "german_business_lunch", "DE");
    const labels = draft.catalogCategories.map((c) => c.displayName);
    expect(labels.some((l) => l.includes("Påsmurt"))).toBe(false);
    expect(labels.some((l) => l.includes("Salatboks"))).toBe(false);
    expect(getLocalizedCategoryLabel("de-DE", "sandwich")).toBe("Belegte Brötchen");
  });

  it("all 9 locales produce 5 hotMeal days and localized labels", () => {
    const locales = [
      ["nb-NO", "norwegian_company_lunch", "NO"],
      ["sv-SE", "swedish_lunch", "SE"],
      ["da-DK", "danish_office_lunch", "DK"],
      ["fi-FI", "finnish_office_lunch", "FI"],
      ["de-DE", "german_business_lunch", "DE"],
      ["en-GB", "uk_office_lunch", "GB"],
      ["fr-FR", "french_dejeuner", "FR"],
      ["es-ES", "spanish_menu_del_dia", "ES"],
      ["it-IT", "italian_office_lunch", "IT"],
    ] as const;
    for (const [locale, profile, country] of locales) {
      expect(isSupportedApplyMenuLocale(locale)).toBe(true);
      const draft = buildDraft(locale, profile, country);
      expect(draft.days.length).toBe(5);
      const sandwich = draft.catalogCategories.find((c) => c.categoryKey === "sandwich");
      expect(sandwich?.displayName).toBeTruthy();
      if (locale !== "nb-NO") {
        expect(sandwich?.displayName.toLowerCase()).not.toContain("påsmurt");
        expect(sandwich?.displayName.toLowerCase()).not.toContain("salatboks");
      }
    }
  });

  it("enterprise premiumUpgrade keeps hotMeal identity", () => {
    const draft = buildFullLocalizedWeekMenuDraft({
      providerId: PROVIDER,
      weekStart: WEEK,
      menuLocale: "nb-NO",
      country: "NO",
      menuProfileId: "norwegian_company_lunch",
      packageTier: "ENTERPRISE",
      enabledCategories: FIXED_CATEGORY_KEYS,
      economyConfig: economy("NO"),
    });
    const day = draft.days[0];
    const hot = day?.categories.find((c) => c.categoryKey === "hotMeal")?.items[0];
    const premium = day?.categories.find((c) => c.categoryKey === "premiumUpgrade")?.items[0];
    if (hot && premium) {
      expect(
        enterpriseHotMealIdentityStable(
          {
            mealTitle: hot.title,
            description: hot.description,
            allergensText: hot.allergens.join(", "),
            itemKey: hot.itemKey,
            slug: hot.sourceDishSlug,
            hotMealBaseItemKey: hot.enterpriseUpgradeBaseItemKey,
            isPremiumUpgrade: hot.isPremiumUpgrade,
          },
          {
            dayIndex: 0,
            date: day!.date,
            categoryKey: "premiumUpgrade",
            tier: "ENTERPRISE",
            itemKey: premium.itemKey,
            choiceKey: premium.choiceKey,
            slug: premium.sourceDishSlug,
            title: premium.title,
            description: premium.description,
            allergens: [],
            tags: premium.tags,
            hotMealBaseItemKey: premium.enterpriseUpgradeBaseItemKey,
            isPremiumUpgrade: true,
            economy: null,
          },
        ),
      ).toBe(true);
    }
  });

  it("formats catalog allergens to allowlist", () => {
    expect(formatAllergensForCatalog(["gluten", "melk"])).toEqual(["hvete", "melk"]);
  });

  it("stop_if_published_exists blocks varmrett week", () => {
    const existing: ProviderMenuDayRow[] = [
      {
        id: "pub",
        date: DATES[0]!,
        tier: "BASIS",
        category: "varmrett",
        mealTitle: "Pub",
        description: "Published meal description.",
        allergens: [],
        estimatedCostPerPortion: null,
        sourcePackage: null,
        upgradeType: null,
        upgradeNote: null,
        approvedForPublish: true,
        customerVisible: true,
        status: "published",
      },
    ];
    const draft = buildDraft("nb-NO", "norwegian_company_lunch", "NO");
    const diff = buildFullApplyDiff({
      draft,
      existingRows: existing,
      catalog: EMPTY_PROVIDER_MENU_CATALOG,
      overwriteMode: "stop_if_published_exists",
      lockState: EMPTY_LOCK,
      categoryScope: "all_supported",
    });
    expect(diff.blockedReasons.length).toBeGreaterThan(0);
  });

  it("de-DE dish titles avoid forbidden Norwegian terms", () => {
    const draft = buildDraft("de-DE", "german_business_lunch", "DE");
    const serialized = JSON.stringify(draft);
    expect(serialized.includes("Påsmurt")).toBe(false);
    expect(serialized.includes("Salatboks")).toBe(false);
    expect(serialized.includes("Ost & Skinke")).toBe(false);
    expect(serialized.includes("Kylling karri")).toBe(false);
    const veg = draft.catalogCategories.find((c) => c.categoryKey === "vegetarian");
    expect(veg?.displayName).toBe("Vegetarisch");
  });

  it("all 9 locales expose localized vegetarian category label", () => {
    const expected: Record<string, string> = {
      "nb-NO": "Vegetar",
      "sv-SE": "Vegetariskt",
      "da-DK": "Vegetarisk",
      "fi-FI": "Kasvis",
      "de-DE": "Vegetarisch",
      "en-GB": "Vegetarian",
      "fr-FR": "Végétarien",
      "es-ES": "Vegetariano",
      "it-IT": "Vegetariano",
    };
    for (const [locale, label] of Object.entries(expected)) {
      expect(getLocalizedCategoryLabel(locale as MenuLocale, "vegetarian")).toBe(label);
    }
  });
});
