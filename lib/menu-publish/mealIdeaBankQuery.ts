import type { SanityClient } from "@sanity/client";

import { OSLO_TZ } from "@/lib/date/oslo";

import type { Meal, PlanTier } from "./generateWeekMenu";

export const MEAL_BANK_TARGET_PRICE = 90;

export function mealBankCostTierClause(includePremium: boolean): string {
  return includePremium
    ? `costTier in ["BUDGET", "STANDARD", "PREMIUM"]`
    : `costTier in ["BUDGET", "STANDARD"]`;
}

/**
 * Norsk sesong + «helår» + tom/mangler `season` (all-year), i tråd med prod mealIdea-data.
 * Kalendermåned i Europe/Oslo — samme sannhet som cron.
 */
export function getCurrentNorwegianSeason(date: Date): "vinter" | "vår" | "sommer" | "høst" {
  const monthStr = new Intl.DateTimeFormat("en-GB", {
    timeZone: OSLO_TZ,
    month: "numeric",
  }).format(date);
  const osloMonth = Number.parseInt(monthStr, 10);
  if (!Number.isFinite(osloMonth) || osloMonth < 1 || osloMonth > 12) {
    return "vinter";
  }
  if (osloMonth === 12 || osloMonth <= 2) return "vinter";
  if (osloMonth <= 5) return "vår";
  if (osloMonth <= 8) return "sommer";
  return "høst";
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
 * Meal pool for week generation (cron, CLI). Sesong: norsk + helår; manglende/tom array = all-year.
 */
export async function fetchMealIdeaBank(
  sanity: SanityClient,
  tier: PlanTier,
  includePremium: boolean,
  /** For tester og deterministisk cron-replay; standard: nå. */
  clock: Date = new Date(),
): Promise<Meal[]> {
  const currentSeason = getCurrentNorwegianSeason(clock);
  const costPart = mealBankCostTierClause(includePremium);
  const enterpriseOnly =
    tier === "ENTERPRISE"
      ? `count(allowedPlanTiers) == 1 && allowedPlanTiers[0] == "ENTERPRISE"`
      : `$tier in allowedPlanTiers`;
  /** <= 90: skjema (mealIdea) tillater maks 90 inkl.; `<` ekskluderte kost = 90. */
  const costCap =
    tier === "ENTERPRISE"
      ? `defined(estimatedCostPerPortion)`
      : `defined(estimatedCostPerPortion) && estimatedCostPerPortion <= ${MEAL_BANK_TARGET_PRICE}`;
  const seasonClause = `(!defined(season) || count(season) == 0 || "helår" in season || $currentSeason in season)`;

  const meals = await sanity.fetch<Meal[]>(
    `*[
      _type == "mealIdea" &&
      isActive == true &&
      ${costCap} &&
      ${enterpriseOnly} &&
      ${costPart} &&
      ${seasonClause}
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
    tier === "ENTERPRISE" ? { currentSeason } : { currentSeason, tier },
  );

  return Array.isArray(meals) ? meals : [];
}

/** For diagnose-skript: samme filter som fetch (count + feltutplukk). */
export function mealIdeaBankFilterGroq(tier: PlanTier, includePremium: boolean): string {
  const costPart = mealBankCostTierClause(includePremium);
  const enterpriseOnly =
    tier === "ENTERPRISE"
      ? `count(allowedPlanTiers) == 1 && allowedPlanTiers[0] == "ENTERPRISE"`
      : `$tier in allowedPlanTiers`;
  const costCap =
    tier === "ENTERPRISE"
      ? `defined(estimatedCostPerPortion)`
      : `defined(estimatedCostPerPortion) && estimatedCostPerPortion <= ${MEAL_BANK_TARGET_PRICE}`;
  const seasonClause = `(!defined(season) || count(season) == 0 || "helår" in season || $currentSeason in season)`;
  return `_type == "mealIdea" && isActive == true && ${costCap} && ${enterpriseOnly} && ${costPart} && ${seasonClause}`;
}
