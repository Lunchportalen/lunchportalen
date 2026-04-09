/**
 * Firma-admin onboarding: typed agreement draft (UI layer).
 * Weekday keys match server meal_contract / delivery_days (mon–fri).
 */

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri";

export type PlanKey = "basis" | "luxus";

import type { FallbackBasisMealKey, FallbackLuxusMealKey } from "@/lib/cms/mealTierFallback";

/** Basis: samme nøkler som CMS productPlan (fallback i mealTierFallback). */
export type BasisMealKey = FallbackBasisMealKey;

export type LuxusMealKey = FallbackLuxusMealKey;

export type LocationDraft = {
  name: string;
  address: string;
  instructions: string;
};

export type AgreementPayloadBasis = {
  plan: "basis";
  delivery_days: WeekdayKey[];
  fixed_meal_type: BasisMealKey;
  locations: LocationDraft[];
};

export type AgreementPayloadLuxus = {
  plan: "luxus";
  delivery_days: WeekdayKey[];
  menu_per_day: Record<WeekdayKey, LuxusMealKey>;
  locations: LocationDraft[];
};

export type AgreementPayload = AgreementPayloadBasis | AgreementPayloadLuxus;

export const WEEKDAY_ORDER: WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri"];

export const WEEKDAY_LABELS: Record<WeekdayKey, string> = {
  mon: "Mandag",
  tue: "Tirsdag",
  wed: "Onsdag",
  thu: "Torsdag",
  fri: "Fredag",
};

export const PLAN_PRICES_EX_VAT: Record<PlanKey, number> = {
  basis: 90,
  luxus: 130,
};
