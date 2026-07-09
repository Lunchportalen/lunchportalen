/**
 * Domain model for full localized generated week menu draft apply.
 */

import { generateProviderWeekMenu } from "@/lib/menu-generator/generateProviderWeekMenu";
import { getLocalizedCategoryLabel } from "@/lib/menu-generator/localizedCategoryLabels";
import { resolveMenuApplyCapabilities } from "@/lib/menu-generator/applyCapabilities";
import { formatAllergensForCatalog, formatAllergensForMenuDay } from "@/lib/menu-generator/allergenMenuDayFormat";
import type {
  EconomyConfig,
  FixedCategoryKey,
  GeneratedMenuChoiceInternal,
  MenuLocale,
} from "@/lib/menu-generator/types";
import type { MenuProfileId } from "@/lib/menu-profile/types";
import type { PlanTier } from "@/lib/cms/menuDayContract";
import { LOCALIZED_MENU_GENERATOR_VERSION } from "@/lib/menu-generator/applyTypes";

export type FullApplyMenuItem = {
  itemKey: string;
  choiceKey: string;
  categoryKey: FixedCategoryKey;
  title: string;
  description: string;
  allergens: readonly string[];
  tags: readonly string[];
  menuLocale: MenuLocale;
  sourceDishSlug: string;
  tierAvailability: readonly PlanTier[];
  enterpriseUpgradeBaseItemKey: string | null;
  isPremiumUpgrade: boolean;
};

export type FullApplyCategoryDraft = {
  categoryKey: FixedCategoryKey;
  displayName: string;
  source: "localized_fixed_generator";
  schemaSupport: "supported" | "unsupported";
  writeTarget: "menuDay" | "lunchCategory" | "unsupported";
  items: FullApplyMenuItem[];
  tierAvailability: readonly PlanTier[];
};

export type FullApplyDayDraft = {
  date: string;
  weekday: string;
  categories: FullApplyCategoryDraft[];
};

export type FullLocalizedGeneratedWeekMenuDraft = {
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  country: string;
  menuProfileId: MenuProfileId;
  generatorVersion: string;
  packageTier: PlanTier;
  days: FullApplyDayDraft[];
  /** Week-aggregated catalog categories (fixed keys → unique items). */
  catalogCategories: FullApplyCategoryDraft[];
  capabilities: ReturnType<typeof resolveMenuApplyCapabilities>;
};

const WEEKDAY_LABELS = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];

function choiceToItem(choice: GeneratedMenuChoiceInternal, menuLocale: MenuLocale): FullApplyMenuItem {
  return {
    itemKey: choice.itemKey,
    choiceKey: choice.choiceKey,
    categoryKey: choice.categoryKey,
    title: choice.title,
    description: choice.description,
    allergens: choice.categoryKey === "hotMeal" || choice.categoryKey === "premiumUpgrade"
      ? formatAllergensForMenuDay(choice.allergens, menuLocale).split(/,\s*/).filter(Boolean)
      : formatAllergensForCatalog(choice.allergens),
    tags: choice.tags,
    menuLocale,
    sourceDishSlug: choice.slug,
    tierAvailability: [choice.tier],
    enterpriseUpgradeBaseItemKey: choice.hotMealBaseItemKey,
    isPremiumUpgrade: choice.isPremiumUpgrade,
  };
}

function buildCategoryDraft(
  categoryKey: FixedCategoryKey,
  items: FullApplyMenuItem[],
  menuLocale: MenuLocale,
): FullApplyCategoryDraft {
  const cap = resolveMenuApplyCapabilities().categories[categoryKey];
  return {
    categoryKey,
    displayName: getLocalizedCategoryLabel(menuLocale, categoryKey),
    source: "localized_fixed_generator",
    schemaSupport: cap.supported ? "supported" : "unsupported",
    writeTarget: cap.writeTarget,
    items,
    tierAvailability: [...new Set(items.flatMap((i) => i.tierAvailability))],
  };
}

export function buildFullLocalizedWeekMenuDraft(input: {
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  country: string;
  menuProfileId: MenuProfileId;
  packageTier: PlanTier;
  enabledCategories: readonly FixedCategoryKey[];
  economyConfig: EconomyConfig;
}): FullLocalizedGeneratedWeekMenuDraft {
  const generated = generateProviderWeekMenu({
    providerId: input.providerId,
    weekStart: input.weekStart,
    menuLocale: input.menuLocale,
    country: input.country,
    menuProfileId: input.menuProfileId,
    packageTier: input.packageTier,
    enabledCategories: input.enabledCategories,
    economyConfig: input.economyConfig,
  });

  const capabilities = resolveMenuApplyCapabilities();
  const catalogItemMap = new Map<FixedCategoryKey, Map<string, FullApplyMenuItem>>();

  const days: FullApplyDayDraft[] = generated.days.map((day, idx) => {
    const byCategory = new Map<FixedCategoryKey, FullApplyMenuItem[]>();
    for (const choice of day.choices) {
      const item = choiceToItem(choice, input.menuLocale);
      const list = byCategory.get(choice.categoryKey) ?? [];
      list.push(item);
      byCategory.set(choice.categoryKey, list);

      const cap = capabilities.categories[choice.categoryKey];
      if (cap.writeTarget === "lunchCategory") {
        const catMap = catalogItemMap.get(choice.categoryKey) ?? new Map();
        if (!catMap.has(item.sourceDishSlug)) catMap.set(item.sourceDishSlug, item);
        catalogItemMap.set(choice.categoryKey, catMap);
      }
    }

    const categories: FullApplyCategoryDraft[] = [];
    for (const [categoryKey, items] of byCategory) {
      categories.push(buildCategoryDraft(categoryKey, items, input.menuLocale));
    }

    return {
      date: day.date,
      weekday: WEEKDAY_LABELS[idx] ?? day.date,
      categories,
    };
  });

  const catalogCategories: FullApplyCategoryDraft[] = [];
  for (const [categoryKey, itemMap] of catalogItemMap) {
    catalogCategories.push(buildCategoryDraft(categoryKey, [...itemMap.values()], input.menuLocale));
  }

  for (const unsupportedKey of capabilities.unsupportedCategories) {
    const itemsFromWeek: FullApplyMenuItem[] = [];
    for (const day of generated.days) {
      for (const choice of day.choices) {
        if (choice.categoryKey === unsupportedKey) {
          itemsFromWeek.push(choiceToItem(choice, input.menuLocale));
        }
      }
    }
    if (itemsFromWeek.length) {
      catalogCategories.push(buildCategoryDraft(unsupportedKey, itemsFromWeek, input.menuLocale));
    }
  }

  return {
    providerId: input.providerId,
    weekStart: input.weekStart,
    menuLocale: input.menuLocale,
    country: input.country,
    menuProfileId: input.menuProfileId,
    generatorVersion: LOCALIZED_MENU_GENERATOR_VERSION,
    packageTier: input.packageTier,
    days,
    catalogCategories,
    capabilities,
  };
}
