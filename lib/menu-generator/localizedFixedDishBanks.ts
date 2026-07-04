import { ALL_LOCALE_BANKS } from "@/lib/menu-generator/dishBanks/localeData";
import { countByCategory } from "@/lib/menu-generator/dishBanks/buildDish";
import type {
  FixedCategoryKey,
  FixedDishDefinition,
  MenuLocale,
} from "@/lib/menu-generator/types";
import { SUPPORTED_MENU_LOCALES } from "@/lib/menu-generator/types";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";

const FALLBACK_LOCALE: MenuLocale = "nb-NO";

export function isSupportedMenuLocale(value: unknown): value is MenuLocale {
  return (
    typeof value === "string" &&
    (SUPPORTED_MENU_LOCALES as readonly string[]).includes(value.trim())
  );
}

export function menuLocaleFromProfileLocale(profileLocale: string): MenuLocale | null {
  const normalized = String(profileLocale ?? "").trim();
  if (isSupportedMenuLocale(normalized)) return normalized;
  return null;
}

export function resolveMenuLocale(input: {
  menuLocale?: unknown;
  profileLocale?: unknown;
}): { menuLocale: MenuLocale; usedFallback: boolean } {
  const direct = String(input.menuLocale ?? "").trim();
  if (isSupportedMenuLocale(direct)) {
    return { menuLocale: direct, usedFallback: false };
  }

  const fromProfile = menuLocaleFromProfileLocale(String(input.profileLocale ?? ""));
  if (fromProfile) {
    return { menuLocale: fromProfile, usedFallback: false };
  }

  return { menuLocale: FALLBACK_LOCALE, usedFallback: true };
}

export function getFixedDishBankForLocale(menuLocale: MenuLocale): readonly FixedDishDefinition[] {
  return ALL_LOCALE_BANKS[menuLocale] ?? ALL_LOCALE_BANKS[FALLBACK_LOCALE];
}

export function getFixedDishesByCategory(
  menuLocale: MenuLocale,
  categoryKey: FixedCategoryKey,
): readonly FixedDishDefinition[] {
  return getFixedDishBankForLocale(menuLocale).filter((d) => d.categoryKey === categoryKey);
}

export type FixedDishBankStatus = {
  menuLocale: MenuLocale;
  totalDishes: number;
  countsByCategory: Partial<Record<FixedCategoryKey, number>>;
  meetsMinimums: boolean;
};

const MINIMUMS: Partial<Record<FixedCategoryKey, number>> = {
  sandwich: 8,
  salad: 8,
  hotMeal: 10,
  vegetarian: 5,
  premiumUpgrade: 5,
  sushi: 5,
  poke: 5,
  asian: 5,
};

export function assessFixedDishBankStatus(menuLocale: MenuLocale): FixedDishBankStatus {
  const bank = getFixedDishBankForLocale(menuLocale);
  const countsByCategory = countByCategory(bank);
  const meetsMinimums = Object.entries(MINIMUMS).every(([key, min]) => {
    const count = countsByCategory[key as FixedCategoryKey] ?? 0;
    return count >= (min ?? 0);
  });

  return {
    menuLocale,
    totalDishes: bank.length,
    countsByCategory,
    meetsMinimums,
  };
}

export function defaultMenuLocaleForCountry(countryCode: string): MenuLocale {
  const normalized = String(countryCode ?? "").trim().toUpperCase();
  const marketMap: Record<string, MenuLocale> = {
    NO: "nb-NO",
    SE: "sv-SE",
    DK: "da-DK",
    FI: "fi-FI",
    DE: "de-DE",
    GB: "en-GB",
    UK: "en-GB",
    FR: "fr-FR",
    ES: "es-ES",
    IT: "it-IT",
  };
  const locale = marketMap[normalized];
  if (locale) return locale;
  return getMarketDefaults("NO").defaultLocale as MenuLocale;
}

export { FALLBACK_LOCALE };
