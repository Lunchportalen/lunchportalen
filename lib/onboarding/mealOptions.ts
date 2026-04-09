import { displayLabelForMealTypeKey } from "@/lib/cms/mealTypeDisplayFallback";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { FALLBACK_BASIS_MEAL_KEYS, FALLBACK_LUXUS_MEAL_KEYS } from "@/lib/cms/mealTierFallback";
import type { BasisMealKey, LuxusMealKey } from "@/lib/onboarding/types";

function opt<K extends string>(keys: readonly K[]): { key: K; label: string }[] {
  return keys.map((k) => {
    const nk = normalizeMealTypeKey(k);
    return { key: k, label: displayLabelForMealTypeKey(nk || k, null) };
  });
}

/** CMS-styrt i wizard når `loadFirmaOnboardingCms` leverer data; ellers nøkler fra samme fallback som productPlan-seed. */
export const BASIS_MEAL_OPTIONS: { key: BasisMealKey; label: string }[] = opt(FALLBACK_BASIS_MEAL_KEYS);

export const LUXUS_MEAL_OPTIONS: { key: LuxusMealKey; label: string }[] = opt(FALLBACK_LUXUS_MEAL_KEYS);

export const LUXUS_KEYS = new Set(LUXUS_MEAL_OPTIONS.map((o) => o.key));
