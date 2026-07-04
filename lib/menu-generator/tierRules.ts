import type { PlanTier } from "@/lib/cms/menuDayContract";
import type { FixedCategoryKey } from "@/lib/menu-generator/types";

const BASIS_CATEGORIES: readonly FixedCategoryKey[] = ["sandwich", "salad", "hotMeal"];

const LUXUS_EXTRA_CATEGORIES: readonly FixedCategoryKey[] = [
  "sushi",
  "poke",
  "asian",
  "vegetarian",
];

const ENTERPRISE_EXTRA: readonly FixedCategoryKey[] = ["premiumUpgrade"];

/** Locales with sushi/poke/asian in Luxus tier. */
const ASIAN_ENABLED_LOCALES = new Set([
  "nb-NO",
  "sv-SE",
  "da-DK",
  "fi-FI",
  "de-DE",
  "en-GB",
  "fr-FR",
  "es-ES",
  "it-IT",
]);

export function categoriesForTier(
  tier: PlanTier,
  menuLocale: string,
  enabledCategories?: readonly FixedCategoryKey[],
): FixedCategoryKey[] {
  const enabled = new Set<FixedCategoryKey>(enabledCategories ?? []);
  const allowAsian = ASIAN_ENABLED_LOCALES.has(menuLocale);

  const basis = BASIS_CATEGORIES.filter((c) => !enabled.size || enabled.has(c));

  if (tier === "BASIS") {
    return [...basis];
  }

  const luxusExtras = LUXUS_EXTRA_CATEGORIES.filter((c) => {
    if (enabled.size && !enabled.has(c)) return false;
    if (["sushi", "poke", "asian"].includes(c) && !allowAsian) return false;
    return true;
  });

  if (tier === "LUXUS") {
    return [...basis, ...luxusExtras];
  }

  if (tier === "ENTERPRISE") {
    const enterpriseExtras = ENTERPRISE_EXTRA.filter((c) => !enabled.size || enabled.has(c));
    return [...basis, ...luxusExtras, ...enterpriseExtras];
  }

  return [...basis];
}

export function isEnterprisePremiumUpgradeCategory(categoryKey: FixedCategoryKey): boolean {
  return categoryKey === "premiumUpgrade";
}

export function tierIncludesCategory(
  tier: PlanTier,
  categoryKey: FixedCategoryKey,
  menuLocale: string,
  enabledCategories?: readonly FixedCategoryKey[],
): boolean {
  return categoriesForTier(tier, menuLocale, enabledCategories).includes(categoryKey);
}
