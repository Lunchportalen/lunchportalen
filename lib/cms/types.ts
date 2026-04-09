import type { WeekdayKeyMonFri } from "@/lib/date/weekdayKeyFromIso";

export type { WeekdayKeyMonFri };

export type CmsProductPlanRules = {
  allowDailyVariation: boolean;
};

export type CmsProductPlan = {
  name: "basis" | "luxus";
  price: number;
  /** Canonical allowlist; keys match DB choice_key / menu.mealType */
  allowedMeals: string[];
  rules: CmsProductPlanRules;
};

export type CmsMenuVariant = {
  title?: string | null;
  description?: string | null;
  mealType?: string | null;
};

export type CmsMenuByMealType = {
  mealType: string;
  title: string;
  description?: string | null;
  /** Resolved image URLs (gallery + legacy single image) */
  images: string[];
  /** First image for compact UIs */
  imageUrl?: string | null;
  allergens?: string[] | null;
  nutrition?: { calories?: number | null; protein_g?: number | null } | null;
  variants?: CmsMenuVariant[] | null;
};

export type CmsWeekTemplate = {
  name: string;
  days: Partial<Record<WeekdayKeyMonFri, string>>;
};
