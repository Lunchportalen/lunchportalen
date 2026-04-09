import type { StoredMealContract } from "@/lib/server/agreements/mealContract";
import { resolveAgreementMealTypeForDay } from "@/lib/server/agreements/mealContract";

/**
 * mealType for a weekday from DB `meal_contract` (agreement_json).
 * Basis → fixed_meal_type; Luxus → menu_per_day[dayKey]; falls back to legacyChoiceKey when contract is missing.
 */
export function resolveMenuForDay(args: {
  dayKey: string;
  mealContract: StoredMealContract | null;
  legacyChoiceKey?: string | null;
}): string | null {
  return resolveAgreementMealTypeForDay({
    dayKey: args.dayKey,
    mealContract: args.mealContract,
    legacyChoiceKey: args.legacyChoiceKey ?? null,
  });
}
