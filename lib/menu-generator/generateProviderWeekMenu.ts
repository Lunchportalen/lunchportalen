import { addDaysISO } from "@/lib/date/oslo";
import type { PlanTier } from "@/lib/cms/menuDayContract";
import { resolveEconomyConfigForCountry } from "@/lib/menu-generator/countryEconomyDefaults";
import {
  buildSelectionSeed,
  deterministicIndex,
  hashStringToUint32,
} from "@/lib/menu-generator/deterministicHash";
import { getFixedDishesByCategory } from "@/lib/menu-generator/localizedFixedDishBanks";
import { buildStableChoiceKey, buildStableItemKey } from "@/lib/menu-generator/itemKeys";
import {
  categoriesForTier,
  isEnterprisePremiumUpgradeCategory,
} from "@/lib/menu-generator/tierRules";
import type {
  EconomyConfig,
  FixedCategoryKey,
  FixedDishDefinition,
  GenerateProviderWeekMenuInput,
  GeneratedMenuChoiceInternal,
  GeneratedProviderWeekMenu,
  MenuLocale,
} from "@/lib/menu-generator/types";

function economyForCategory(
  categoryKey: FixedCategoryKey,
  economyConfig: EconomyConfig,
): GeneratedMenuChoiceInternal["economy"] {
  const { internalCostFields, currency, vatRate } = economyConfig;
  let providerCost = internalCostFields.hotMealCost;
  if (categoryKey === "sandwich") providerCost = internalCostFields.sandwichCost;
  else if (categoryKey === "salad") providerCost = internalCostFields.saladCost;
  else if (categoryKey === "premiumUpgrade") providerCost = internalCostFields.premiumUpgradeCost;
  else if (["sushi", "poke", "asian"].includes(categoryKey)) {
    providerCost = internalCostFields.saladCost * 1.1;
  } else if (categoryKey === "vegetarian") {
    providerCost = internalCostFields.hotMealCost * 0.9;
  }

  return { providerCost, currency, vatRate };
}

function pickDeterministicDish(input: {
  pool: readonly FixedDishDefinition[];
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  categoryKey: FixedCategoryKey;
  dayIndex: number;
  usedSlugs: Set<string>;
}): FixedDishDefinition | null {
  if (!input.pool.length) return null;

  const ranked = [...input.pool].sort((a, b) => {
    const seedA = buildSelectionSeed([
      input.providerId,
      input.weekStart,
      input.menuLocale,
      input.categoryKey,
      String(input.dayIndex),
      a.slug,
    ]);
    const seedB = buildSelectionSeed([
      input.providerId,
      input.weekStart,
      input.menuLocale,
      input.categoryKey,
      String(input.dayIndex),
      b.slug,
    ]);
    return hashStringToUint32(seedB) - hashStringToUint32(seedA);
  });

  const unused = ranked.filter((d) => !input.usedSlugs.has(`${input.categoryKey}:${d.slug}`));
  const pickFrom = unused.length ? unused : ranked;
  const idx = deterministicIndex(
    buildSelectionSeed([
      input.providerId,
      input.weekStart,
      input.menuLocale,
      input.categoryKey,
      String(input.dayIndex),
      "pick",
    ]),
    pickFrom.length,
  );
  return pickFrom[idx] ?? null;
}

function buildChoice(input: {
  dish: FixedDishDefinition;
  providerId: string;
  weekStart: string;
  date: string;
  dayIndex: number;
  tier: PlanTier;
  categoryKey: FixedCategoryKey;
  economyConfig: EconomyConfig;
  hotMealBaseItemKey?: string | null;
  isPremiumUpgrade?: boolean;
}): GeneratedMenuChoiceInternal {
  const itemKey = buildStableItemKey(input.dish.menuLocale, input.categoryKey, input.dish.slug);
  const choiceKey = buildStableChoiceKey({
    providerId: input.providerId,
    weekStart: input.weekStart,
    dayIndex: input.dayIndex,
    tier: input.tier,
    itemKey,
  });

  return {
    dayIndex: input.dayIndex,
    date: input.date,
    categoryKey: input.categoryKey,
    tier: input.tier,
    itemKey,
    choiceKey,
    slug: input.dish.slug,
    title: input.dish.title,
    description: input.dish.description,
    allergens: input.dish.allergens,
    tags: input.dish.tags,
    hotMealBaseItemKey: input.hotMealBaseItemKey ?? null,
    isPremiumUpgrade: input.isPremiumUpgrade === true,
    economy: economyForCategory(input.categoryKey, input.economyConfig),
  };
}

export function generateProviderWeekMenu(
  input: GenerateProviderWeekMenuInput,
): GeneratedProviderWeekMenu {
  const weekStart = String(input.weekStart ?? "").trim();
  const providerId = String(input.providerId ?? "").trim();
  const tier = input.packageTier;
  const menuLocale = input.menuLocale;
  const economyConfig = input.economyConfig;

  const tierCategories = categoriesForTier(tier, menuLocale, input.enabledCategories);
  const usedSlugsByCategory = new Map<FixedCategoryKey, Set<string>>();

  const days: GeneratedProviderWeekMenu["days"][number][] = [];
  const hotMealByDay = new Map<number, GeneratedMenuChoiceInternal>();

  for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
    const date = addDaysISO(weekStart, dayIndex);
    const hotMealPool = getFixedDishesByCategory(menuLocale, "hotMeal");
    const hotMealUsed = usedSlugsByCategory.get("hotMeal") ?? new Set<string>();
    const hotMealDish = pickDeterministicDish({
      pool: hotMealPool,
      providerId,
      weekStart,
      menuLocale,
      categoryKey: "hotMeal",
      dayIndex,
      usedSlugs: hotMealUsed,
    });
    if (hotMealDish) {
      hotMealUsed.add(hotMealDish.slug);
      usedSlugsByCategory.set("hotMeal", hotMealUsed);
      hotMealByDay.set(
        dayIndex,
        buildChoice({
          dish: hotMealDish,
          providerId,
          weekStart,
          date,
          dayIndex,
          tier: "BASIS",
          categoryKey: "hotMeal",
          economyConfig,
        }),
      );
    }
  }

  for (let dayIndex = 0; dayIndex < 5; dayIndex += 1) {
    const date = addDaysISO(weekStart, dayIndex);
    const choices: GeneratedMenuChoiceInternal[] = [];
    const canonicalHotMeal = hotMealByDay.get(dayIndex) ?? null;
    let hotMealItemKey: string | null = canonicalHotMeal?.itemKey ?? null;

    for (const categoryKey of tierCategories) {
      if (isEnterprisePremiumUpgradeCategory(categoryKey)) {
        if (!hotMealItemKey) continue;
        const upgradePool = getFixedDishesByCategory(menuLocale, "premiumUpgrade");
        const used = usedSlugsByCategory.get("premiumUpgrade") ?? new Set<string>();
        const dish = pickDeterministicDish({
          pool: upgradePool,
          providerId,
          weekStart,
          menuLocale,
          categoryKey: "premiumUpgrade",
          dayIndex,
          usedSlugs: used,
        });
        if (!dish) continue;
        used.add(dish.slug);
        usedSlugsByCategory.set("premiumUpgrade", used);
        choices.push(
          buildChoice({
            dish,
            providerId,
            weekStart,
            date,
            dayIndex,
            tier,
            categoryKey: "premiumUpgrade",
            economyConfig,
            hotMealBaseItemKey: hotMealItemKey,
            isPremiumUpgrade: true,
          }),
        );
        continue;
      }

      if (categoryKey === "hotMeal") {
        if (!canonicalHotMeal) continue;
        const choice: GeneratedMenuChoiceInternal = {
          ...canonicalHotMeal,
          tier,
          choiceKey: buildStableChoiceKey({
            providerId,
            weekStart,
            dayIndex,
            tier,
            itemKey: canonicalHotMeal.itemKey,
          }),
        };
        choices.push(choice);
        hotMealItemKey = choice.itemKey;
        continue;
      }

      const pool = getFixedDishesByCategory(menuLocale, categoryKey);
      const used = usedSlugsByCategory.get(categoryKey) ?? new Set<string>();
      const dish = pickDeterministicDish({
        pool,
        providerId,
        weekStart,
        menuLocale,
        categoryKey,
        dayIndex,
        usedSlugs: used,
      });
      if (!dish) continue;
      used.add(dish.slug);
      usedSlugsByCategory.set(categoryKey, used);

      choices.push(
        buildChoice({
          dish,
          providerId,
          weekStart,
          date,
          dayIndex,
          tier,
          categoryKey,
          economyConfig,
        }),
      );
    }

    days.push({ dayIndex, date, choices });
  }

  return {
    providerId,
    weekStart,
    menuLocale,
    menuProfileId: input.menuProfileId,
    packageTier: tier,
    days,
  };
}
