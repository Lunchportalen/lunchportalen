/**
 * Localized category display labels — stable categoryKey, locale-driven displayName.
 * Provider menuLocale controls labels; employee UI locale must not override these.
 */

import type { Category } from "@/lib/cms/menuDayContract";
import type { FixedCategoryKey, MenuLocale } from "@/lib/menu-generator/types";
import { SUPPORTED_MENU_LOCALES } from "@/lib/menu-generator/types";

export type LocalizedCategoryLabelMap = Record<FixedCategoryKey, string>;

const CATEGORY_LABELS_BY_LOCALE: Record<MenuLocale, LocalizedCategoryLabelMap> = {
  "nb-NO": {
    sandwich: "Påsmurt",
    salad: "Salatboks",
    hotMeal: "Varmrett",
    vegetarian: "Vegetar",
    sushi: "Sushi",
    poke: "Pokébowl",
    asian: "Thaimat / Asiatisk",
    premiumUpgrade: "Premiumoppgradering",
  },
  "sv-SE": {
    sandwich: "Mackor",
    salad: "Sallader",
    hotMeal: "Varmrätt",
    vegetarian: "Vegetariskt",
    sushi: "Sushi",
    poke: "Poké bowl",
    asian: "Asiatiskt",
    premiumUpgrade: "Premiumuppgradering",
  },
  "da-DK": {
    sandwich: "Smørrebrød",
    salad: "Salater",
    hotMeal: "Varm ret",
    vegetarian: "Vegetarisk",
    sushi: "Sushi",
    poke: "Poké bowl",
    asian: "Asiatisk",
    premiumUpgrade: "Premiumopgradering",
  },
  "fi-FI": {
    sandwich: "Voileivät",
    salad: "Salaatit",
    hotMeal: "Lämmin ruoka",
    vegetarian: "Kasvis",
    sushi: "Sushi",
    poke: "Poké bowl",
    asian: "Aasialainen",
    premiumUpgrade: "Premium-lisä",
  },
  "de-DE": {
    sandwich: "Belegte Brötchen",
    salad: "Salate",
    hotMeal: "Warme Gerichte",
    vegetarian: "Vegetarisch",
    sushi: "Sushi",
    poke: "Poké Bowl",
    asian: "Asiatisch",
    premiumUpgrade: "Premium-Erweiterung",
  },
  "en-GB": {
    sandwich: "Sandwiches",
    salad: "Salads",
    hotMeal: "Hot meals",
    vegetarian: "Vegetarian",
    sushi: "Sushi",
    poke: "Poké bowls",
    asian: "Asian",
    premiumUpgrade: "Premium upgrade",
  },
  "fr-FR": {
    sandwich: "Sandwichs",
    salad: "Salades",
    hotMeal: "Plats chauds",
    vegetarian: "Végétarien",
    sushi: "Sushi",
    poke: "Poké bowls",
    asian: "Asiatique",
    premiumUpgrade: "Supplément premium",
  },
  "es-ES": {
    sandwich: "Bocadillos",
    salad: "Ensaladas",
    hotMeal: "Platos calientes",
    vegetarian: "Vegetariano",
    sushi: "Sushi",
    poke: "Poké bowls",
    asian: "Asiático",
    premiumUpgrade: "Mejora premium",
  },
  "it-IT": {
    sandwich: "Panini",
    salad: "Insalate",
    hotMeal: "Piatti caldi",
    vegetarian: "Vegetariano",
    sushi: "Sushi",
    poke: "Poké bowl",
    asian: "Asiatico",
    premiumUpgrade: "Upgrade premium",
  },
};

const FALLBACK_LOCALE: MenuLocale = "nb-NO";

/** Runtime Category slug → generator FixedCategoryKey. */
export const RUNTIME_CATEGORY_TO_FIXED_KEY: Partial<Record<Category, FixedCategoryKey>> = {
  paasmurt: "sandwich",
  salat: "salad",
  varmrett: "hotMeal",
  sushi: "sushi",
  pokebowl: "poke",
  thai: "asian",
};

/** Sanity lunchCategory row key → generator FixedCategoryKey. */
export const LUNCH_CATEGORY_KEY_TO_FIXED_KEY: Record<string, FixedCategoryKey> = {
  paasmurt: "sandwich",
  salatboks: "salad",
  varmrett: "hotMeal",
  sushi: "sushi",
  pokebowl: "poke",
  thaimat: "asian",
};

export function getLocalizedCategoryLabels(menuLocale: MenuLocale): LocalizedCategoryLabelMap {
  const labels = CATEGORY_LABELS_BY_LOCALE[menuLocale];
  if (labels) return labels;

  if (typeof console !== "undefined") {
    console.warn(
      `[menu-generator] missing category labels for locale ${menuLocale}; fallback ${FALLBACK_LOCALE}`,
    );
  }
  return CATEGORY_LABELS_BY_LOCALE[FALLBACK_LOCALE];
}

export function getLocalizedCategoryLabel(
  menuLocale: MenuLocale,
  categoryKey: FixedCategoryKey,
): string {
  return getLocalizedCategoryLabels(menuLocale)[categoryKey];
}

export function buildLocalizedRuntimeCategoryLabels(
  menuLocale: MenuLocale,
): Partial<Record<Category, string>> {
  const fixedLabels = getLocalizedCategoryLabels(menuLocale);
  const out: Partial<Record<Category, string>> = {};

  for (const [runtimeCategory, fixedKey] of Object.entries(RUNTIME_CATEGORY_TO_FIXED_KEY)) {
    out[runtimeCategory as Category] = fixedLabels[fixedKey as FixedCategoryKey];
  }

  return out;
}

export function isSupportedMenuLocaleForLabels(value: unknown): value is MenuLocale {
  return typeof value === "string" && (SUPPORTED_MENU_LOCALES as readonly string[]).includes(value.trim());
}
