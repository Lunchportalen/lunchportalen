/**
 * Map localized generator output to existing varmrett draft write input.
 */

import type { PlanTier } from "@/lib/cms/menuDayContract";
import { generateProviderWeekMenu } from "@/lib/menu-generator/generateProviderWeekMenu";
import { formatAllergensForMenuDay } from "@/lib/menu-generator/allergenMenuDayFormat";
import type { ApplyGeneratedVarmrettState } from "@/lib/menu-generator/applyWeekMenuDiff";
import type {
  EconomyConfig,
  FixedCategoryKey,
  GenerateProviderWeekMenuInput,
  GeneratedMenuChoiceInternal,
  MenuLocale,
} from "@/lib/menu-generator/types";
import type { MenuProfileId } from "@/lib/menu-profile/types";

export type MappedApplyWeek = {
  generated: ReturnType<typeof generateProviderWeekMenu>;
  varmrettByDate: Map<string, ApplyGeneratedVarmrettState>;
  catalogChoicesByDate: Map<string, GeneratedMenuChoiceInternal[]>;
};

function extractHotMealChoice(
  choices: readonly GeneratedMenuChoiceInternal[],
): GeneratedMenuChoiceInternal | null {
  const hot = choices.find((c) => c.categoryKey === "hotMeal");
  return hot ?? null;
}

function toVarmrettState(choice: GeneratedMenuChoiceInternal, menuLocale: MenuLocale): ApplyGeneratedVarmrettState {
  return {
    mealTitle: choice.title,
    description: choice.description,
    allergensText: formatAllergensForMenuDay(choice.allergens, menuLocale),
    itemKey: choice.itemKey,
    slug: choice.slug,
    hotMealBaseItemKey: choice.hotMealBaseItemKey,
    isPremiumUpgrade: choice.isPremiumUpgrade,
  };
}

export function mapGeneratedWeekToApplyTargets(input: {
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  country: string;
  menuProfileId: MenuProfileId;
  packageTier: PlanTier;
  enabledCategories: readonly FixedCategoryKey[];
  economyConfig: EconomyConfig;
}): MappedApplyWeek {
  const genInput: GenerateProviderWeekMenuInput = {
    providerId: input.providerId,
    weekStart: input.weekStart,
    menuLocale: input.menuLocale,
    country: input.country,
    menuProfileId: input.menuProfileId,
    packageTier: input.packageTier,
    enabledCategories: input.enabledCategories,
    economyConfig: input.economyConfig,
  };

  const generated = generateProviderWeekMenu(genInput);
  const varmrettByDate = new Map<string, ApplyGeneratedVarmrettState>();
  const catalogChoicesByDate = new Map<string, GeneratedMenuChoiceInternal[]>();

  for (const day of generated.days) {
    const hotMeal = extractHotMealChoice(day.choices);
    if (hotMeal) {
      varmrettByDate.set(day.date, toVarmrettState(hotMeal, input.menuLocale));
    }
    const catalogBacked = day.choices.filter((c) => c.categoryKey !== "hotMeal" && c.categoryKey !== "premiumUpgrade");
    if (catalogBacked.length) {
      catalogChoicesByDate.set(day.date, catalogBacked);
    }
  }

  return { generated, varmrettByDate, catalogChoicesByDate };
}

/** Enterprise upgrade retains same hotMeal identity when premium upgrade is present. */
export function enterpriseHotMealIdentityStable(
  hotMeal: ApplyGeneratedVarmrettState,
  premiumUpgrade: GeneratedMenuChoiceInternal | null,
): boolean {
  if (!premiumUpgrade?.isPremiumUpgrade) return true;
  if (!premiumUpgrade.hotMealBaseItemKey) return false;
  return premiumUpgrade.hotMealBaseItemKey === hotMeal.itemKey;
}
