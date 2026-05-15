import type { SanityClient } from "@sanity/client";

import type { Meal, PlanTier } from "./generateWeekMenu";

export const MEAL_BANK_TARGET_PRICE = 90;

export function mealBankCostTierClause(includePremium: boolean): string {
  return includePremium
    ? `costTier in ["BUDGET", "STANDARD", "PREMIUM"]`
    : `costTier in ["BUDGET", "STANDARD"]`;
}

/** Same season buckets as `WeekPlanner` (calendar month in local `Date`). */
export function mealBankCurrentSeason(): "winter" | "spring" | "summer" | "autumn" {
  const month = new Date().getMonth() + 1;
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

export function hasCompleteNutrition(meal: Meal): boolean {
  const n = meal.nutritionPer100g;
  return (
    !!n &&
    typeof n.energyKcal === "number" &&
    typeof n.proteinG === "number" &&
    typeof n.carbohydratesG === "number" &&
    typeof n.fatG === "number" &&
    typeof n.saltG === "number"
  );
}

export function normalizeMenuTitleKey(title?: string): string {
  return (title ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+med\b.*$/, "")
    .replace(/\s+\d+$/, "");
}

/**
 * Meal pool for week generation — GROQ aligned with `WeekPlanner.fetchMealBank`.
 */
export async function fetchMealIdeaBank(
  sanity: SanityClient,
  tier: PlanTier,
  includePremium: boolean,
): Promise<Meal[]> {
  const season = mealBankCurrentSeason();
  const costPart = mealBankCostTierClause(includePremium);
  const enterpriseOnly =
    tier === "ENTERPRISE"
      ? `count(allowedPlanTiers) == 1 && allowedPlanTiers[0] == "ENTERPRISE"`
      : `$tier in allowedPlanTiers`;
  const costCap =
    tier === "ENTERPRISE"
      ? `defined(estimatedCostPerPortion)`
      : `defined(estimatedCostPerPortion) && estimatedCostPerPortion < ${MEAL_BANK_TARGET_PRICE}`;

  const meals = await sanity.fetch<Meal[]>(
    `*[
      _type == "mealIdea" &&
      isActive == true &&
      ${costCap} &&
      ${enterpriseOnly} &&
      ${costPart} &&
      (!defined(season) || count(season) == 0 || $season in season)
    ] {
      _id,
      title,
      description,
      tags,
      costTier,
      productionComplexity,
      nutritionScore,
      allergens,
      mayContain,
      nutritionPer100g,
      nutritionNote,
      isActive,
      season,
      kitchenStyle,
      method,
      estimatedCostPerPortion,
      targetPricePerPortion,
      isFishDish,
      isSoup,
      isVegetarian,
      lastUsedDate,
      usageCount
    }`,
    tier === "ENTERPRISE" ? { season } : { season, tier },
  );

  return Array.isArray(meals) ? meals : [];
}
