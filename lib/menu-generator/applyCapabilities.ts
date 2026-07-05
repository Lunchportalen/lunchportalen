/**
 * Schema capability resolver — which generated categories can be applied via existing write paths.
 */

import type { EditableLunchCategoryKey } from "@/lib/provider-menu/lunchCategoryCatalog";
import { FIXED_CATEGORY_KEYS, type FixedCategoryKey } from "@/lib/menu-generator/types";

export type ApplyWriteTarget = "menuDay" | "lunchCategory" | "unsupported";

export type CategoryApplyCapability = {
  categoryKey: FixedCategoryKey;
  supported: boolean;
  writeTarget: ApplyWriteTarget;
  lunchCategoryKey: EditableLunchCategoryKey | null;
  publishedProtection: boolean;
  reason: string | null;
};

export type MenuApplyCapabilities = {
  canApplyFullMenu: boolean;
  supportedCategories: FixedCategoryKey[];
  unsupportedCategories: FixedCategoryKey[];
  writeTargets: Record<FixedCategoryKey, ApplyWriteTarget>;
  publishedProtectionAvailable: boolean;
  reasons: string[];
  warnings: string[];
  categories: Record<FixedCategoryKey, CategoryApplyCapability>;
};

const FIXED_TO_LUNCH: Partial<Record<FixedCategoryKey, EditableLunchCategoryKey>> = {
  sandwich: "paasmurt",
  salad: "salatboks",
  vegetarian: "vegetarian",
  sushi: "sushi",
  poke: "pokebowl",
  asian: "thaimat",
};

function capabilityFor(categoryKey: FixedCategoryKey): CategoryApplyCapability {
  if (categoryKey === "hotMeal") {
    return {
      categoryKey,
      supported: true,
      writeTarget: "menuDay",
      lunchCategoryKey: null,
      publishedProtection: true,
      reason: null,
    };
  }

  if (categoryKey === "premiumUpgrade") {
    return {
      categoryKey,
      supported: true,
      writeTarget: "menuDay",
      lunchCategoryKey: null,
      publishedProtection: true,
      reason: "Enterprise premium metadata på varmrett (ENTERPRISE tier).",
    };
  }

  const lunchKey = FIXED_TO_LUNCH[categoryKey];
  if (lunchKey) {
    return {
      categoryKey,
      supported: true,
      writeTarget: "lunchCategory",
      lunchCategoryKey: lunchKey,
      publishedProtection: false,
      reason: null,
    };
  }

  return {
    categoryKey,
    supported: false,
    writeTarget: "unsupported",
    lunchCategoryKey: null,
    publishedProtection: false,
    reason: "Ukjent kategori.",
  };
}

export function resolveMenuApplyCapabilities(): MenuApplyCapabilities {
  const categories = {} as Record<FixedCategoryKey, CategoryApplyCapability>;
  for (const key of FIXED_CATEGORY_KEYS) {
    categories[key] = capabilityFor(key);
  }

  const supportedCategories = FIXED_CATEGORY_KEYS.filter((k) => categories[k].supported);
  const unsupportedCategories = FIXED_CATEGORY_KEYS.filter((k) => !categories[k].supported);
  const writeTargets = {} as Record<FixedCategoryKey, ApplyWriteTarget>;
  for (const key of FIXED_CATEGORY_KEYS) {
    writeTargets[key] = categories[key].writeTarget;
  }

  const reasons: string[] = [];
  for (const key of unsupportedCategories) {
    const cap = categories[key];
    if (cap.reason) reasons.push(`${key}: ${cap.reason}`);
  }

  const warnings: string[] = [];
  warnings.push(
    "Faste kategorier (sandwich/salad/vegetarian/sushi/poke/asian) applyes via provider lunchCategory-katalog (uke-aggregert).",
  );
  warnings.push("hotMeal applyes som varmrett menuDay-utkast per ukedag.");

  return {
    canApplyFullMenu: unsupportedCategories.length === 0,
    supportedCategories,
    unsupportedCategories,
    writeTargets,
    publishedProtectionAvailable: true,
    reasons,
    warnings,
    categories,
  };
}

export function lunchCategoryKeyForFixed(fixedKey: FixedCategoryKey): EditableLunchCategoryKey | null {
  return FIXED_TO_LUNCH[fixedKey] ?? null;
}
