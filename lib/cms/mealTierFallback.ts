/**
 * Single source for tier meal keys when CMS productPlan is unavailable.
 * Labels: prefer CMS `menu.title` via displayLabelForMealTypeKey(menuDoc).
 */
import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import type { CmsMenuByMealType } from "@/lib/cms/types";

export const FALLBACK_BASIS_MEAL_KEYS = ["salatbar", "paasmurt", "varmmat"] as const;
export const FALLBACK_LUXUS_MEAL_KEYS = [
  ...FALLBACK_BASIS_MEAL_KEYS,
  "sushi",
  "pokebowl",
  "thaimat",
] as const;

export type FallbackBasisMealKey = (typeof FALLBACK_BASIS_MEAL_KEYS)[number];
export type FallbackLuxusMealKey = (typeof FALLBACK_LUXUS_MEAL_KEYS)[number];

export type MealChoice = { key: string; label: string };

export function fallbackChoicesForTier(
  tier: "BASIS" | "LUXUS",
  menuByMealType?: Map<string, CmsMenuByMealType> | null
): MealChoice[] {
  const keys = tier === "BASIS" ? FALLBACK_BASIS_MEAL_KEYS : FALLBACK_LUXUS_MEAL_KEYS;
  return keys.map((k) => {
    const nk = normalizeMealTypeKey(k);
    const m = nk ? menuByMealType?.get(nk) : null;
    return { key: nk || String(k).toLowerCase(), label: displayLabelForMealTypeKey(nk || k, m) };
  });
}

/** Client-safe: no CMS fetch; UTF-8 labels from static fallback map. */
export function fallbackLuxusChoicesClient(): MealChoice[] {
  return FALLBACK_LUXUS_MEAL_KEYS.map((k) => {
    const nk = normalizeMealTypeKey(k);
    return { key: nk || String(k).toLowerCase(), label: displayLabelForMealTypeKey(nk || k, null) };
  });
}

export function fallbackBasisChoicesClient(): MealChoice[] {
  return FALLBACK_BASIS_MEAL_KEYS.map((k) => {
    const nk = normalizeMealTypeKey(k);
    return { key: nk || String(k).toLowerCase(), label: displayLabelForMealTypeKey(nk || k, null) };
  });
}

const legacyBasis = FALLBACK_BASIS_MEAL_KEYS.map((k) => normalizeMealTypeKey(k)).filter(Boolean);
const legacyLuxus = FALLBACK_LUXUS_MEAL_KEYS.map((k) => normalizeMealTypeKey(k)).filter(Boolean);

export const LEGACY_BASIS_MEAL_SET = new Set<string>(legacyBasis);
export const LEGACY_LUXUS_MEAL_SET = new Set<string>(legacyLuxus);
