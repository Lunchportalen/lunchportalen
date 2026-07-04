/**
 * Localized fixed menu generator — types (provider menu locale drives dish bank).
 * Does not touch order write-path or lp_order_set.
 */

import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { CurrencyCode, MarketCode, MenuProfileId, PackageKey } from "@/lib/menu-profile/types";

export const SUPPORTED_MENU_LOCALES = [
  "nb-NO",
  "sv-SE",
  "da-DK",
  "fi-FI",
  "de-DE",
  "en-GB",
  "fr-FR",
  "es-ES",
  "it-IT",
] as const;

export type MenuLocale = (typeof SUPPORTED_MENU_LOCALES)[number];

export const FIXED_CATEGORY_KEYS = [
  "sandwich",
  "salad",
  "hotMeal",
  "vegetarian",
  "sushi",
  "poke",
  "asian",
  "premiumUpgrade",
] as const;

export type FixedCategoryKey = (typeof FIXED_CATEGORY_KEYS)[number];

export type AllergenCode =
  | "gluten"
  | "melk"
  | "egg"
  | "fisk"
  | "skalldyr"
  | "soya"
  | "sesam"
  | "selleri"
  | "sennep"
  | "nøtter"
  | "peanøtter"
  | "sulfitt"
  | "lupin"
  | "bløtdyr";

export type FixedDishDefinition = {
  menuLocale: MenuLocale;
  categoryKey: FixedCategoryKey;
  slug: string;
  title: string;
  description: string;
  allergens: readonly AllergenCode[];
  tags: readonly string[];
  localCultureScore: number;
  enabledByDefault: boolean;
};

export type EconomyConfig = {
  currency: CurrencyCode;
  vatRate: number;
  providerCostBasis: number;
  packagePriceRules: Record<PackageKey, { exVat: number; incVat: number }>;
  marginTarget: number;
  internalCostFields: {
    sandwichCost: number;
    saladCost: number;
    hotMealCost: number;
    premiumUpgradeCost: number;
  };
};

export type ProviderMenuRuntimeProfile = {
  providerId: string;
  country: string;
  market: MarketCode;
  menuLocale: MenuLocale;
  language: string;
  currency: CurrencyCode;
  vatRate: number;
  menuProfileId: MenuProfileId;
  packageModel: PackageKey[];
  enabledCategories: readonly FixedCategoryKey[];
  fixedDishBank: readonly FixedDishDefinition[];
  economyConfig: EconomyConfig;
  usedFallback: boolean;
  fallbackWarning: string | null;
};

export type GenerateProviderWeekMenuInput = {
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  country: string;
  menuProfileId: MenuProfileId;
  packageTier: PlanTier;
  enabledCategories: readonly FixedCategoryKey[];
  economyConfig: EconomyConfig;
};

export type GeneratedMenuChoiceInternal = {
  dayIndex: number;
  date: string;
  categoryKey: FixedCategoryKey;
  tier: PlanTier;
  itemKey: string;
  choiceKey: string;
  slug: string;
  title: string;
  description: string;
  allergens: readonly AllergenCode[];
  tags: readonly string[];
  hotMealBaseItemKey: string | null;
  isPremiumUpgrade: boolean;
  economy: {
    providerCost: number;
    currency: CurrencyCode;
    vatRate: number;
  } | null;
};

export type GeneratedProviderWeekMenu = {
  providerId: string;
  weekStart: string;
  menuLocale: MenuLocale;
  menuProfileId: MenuProfileId;
  packageTier: PlanTier;
  days: readonly {
    dayIndex: number;
    date: string;
    choices: readonly GeneratedMenuChoiceInternal[];
  }[];
};

export type EmployeeSafeMenuChoice = {
  dayIndex: number;
  date: string;
  categoryKey: FixedCategoryKey;
  tier: PlanTier;
  itemKey: string;
  choiceKey: string;
  title: string;
  description: string;
  allergens: readonly AllergenCode[];
};

export type ProviderAdminMenuChoice = EmployeeSafeMenuChoice & {
  slug: string;
  tags: readonly string[];
  hotMealBaseItemKey: string | null;
  isPremiumUpgrade: boolean;
  economy: NonNullable<GeneratedMenuChoiceInternal["economy"]>;
};
