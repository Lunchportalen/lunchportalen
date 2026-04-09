import type {
  AgreementPayload,
  BasisMealKey,
  LocationDraft,
  LuxusMealKey,
  PlanKey,
  WeekdayKey,
} from "@/lib/onboarding/types";
import { WEEKDAY_ORDER } from "@/lib/onboarding/types";

export type WizardDraft = {
  plan: PlanKey | null;
  deliveryDays: WeekdayKey[];
  /** Normalisert mealType-nøkkel (fra CMS allowedMeals) */
  fixedMeal: string | null;
  menuPerDay: Partial<Record<WeekdayKey, string>>;
  locations: LocationDraft[];
};

export function sortDays(days: WeekdayKey[]): WeekdayKey[] {
  const set = new Set(days);
  return WEEKDAY_ORDER.filter((d) => set.has(d));
}

export function buildAgreementPayload(draft: WizardDraft): AgreementPayload | null {
  if (!draft.plan || !draft.deliveryDays.length) return null;
  const delivery_days = sortDays(draft.deliveryDays);
  const locations: LocationDraft[] = draft.locations.map((l) => ({
    name: String(l.name ?? "").trim(),
    address: String(l.address ?? "").trim(),
    instructions: String(l.instructions ?? "").trim(),
  }));
  if (!locations.length || locations.some((l) => !l.name || !l.address)) return null;

  if (draft.plan === "basis") {
    if (!draft.fixedMeal) return null;
    return {
      plan: "basis",
      delivery_days,
      fixed_meal_type: draft.fixedMeal as BasisMealKey,
      locations,
    };
  }

  const menu_per_day = {} as Record<WeekdayKey, LuxusMealKey>;
  for (const d of delivery_days) {
    const v = String(draft.menuPerDay[d] ?? "").trim();
    if (!v) return null;
    menu_per_day[d] = v as LuxusMealKey;
  }
  return {
    plan: "luxus",
    delivery_days,
    menu_per_day,
    locations,
  };
}
