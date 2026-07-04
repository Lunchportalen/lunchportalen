/**
 * Localized provider menu surface — category labels + dish-bank catalog overlay.
 * Display-only; does not change order write-path or Sanity persistence.
 */

import type { Category, PlanTier } from "@/lib/cms/menuDayContract";
import type { EnvLike } from "@/lib/menu-profile/featureFlag";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import type { MenuProfileResolverResult } from "@/lib/menu-profile/types";
import {
  buildLocalizedRuntimeCategoryLabels,
  getLocalizedCategoryLabel,
  LUNCH_CATEGORY_KEY_TO_FIXED_KEY,
} from "@/lib/menu-generator/localizedCategoryLabels";
import { getFixedDishesByCategory } from "@/lib/menu-generator/localizedFixedDishBanks";
import { isLocalizedFixedMenuGeneratorEnabled } from "@/lib/menu-generator/featureFlag";
import { resolveProviderMenuRuntimeProfile } from "@/lib/menu-generator/resolveProviderMenuRuntimeProfile";
import type { FixedCategoryKey, MenuLocale } from "@/lib/menu-generator/types";
import {
  EDITABLE_LUNCH_CATEGORY_KEYS,
  type ProviderMenuCatalogSnapshot,
  type ProviderLunchCategoryItemRow,
  type ProviderLunchCategoryRow,
} from "@/lib/provider-menu/lunchCategoryCatalog";
import type { ProviderSettingsMenuProfileRow } from "@/lib/providers/loadProviderSettingsMenuProfile";

const PLAN_TIERS: PlanTier[] = ["BASIS", "LUXUS", "ENTERPRISE"];

const PREMIUM_LUNCH_KEYS = new Set<string>(["sushi", "pokebowl", "thaimat"]);

const MAX_DISH_BANK_ITEMS_PER_CATEGORY = 12;

export type LocalizedMenuSurfacePresentation =
  | { active: false }
  | {
      active: true;
      menuLocale: MenuLocale;
      menuProfileId: string;
      profileName: string;
      country: string;
      categoryLabels: Partial<Record<Category, string>>;
      catalogOverlay: ProviderMenuCatalogSnapshot;
      fallbackWarning: string | null;
    };

function tierAccessForLunchKey(lunchKey: string): PlanTier[] {
  return PREMIUM_LUNCH_KEYS.has(lunchKey) ? ["LUXUS", "ENTERPRISE"] : [...PLAN_TIERS];
}

function dishBankItemsForCategory(
  menuLocale: MenuLocale,
  fixedKey: FixedCategoryKey,
): ProviderLunchCategoryItemRow[] {
  return getFixedDishesByCategory(menuLocale, fixedKey)
    .slice(0, MAX_DISH_BANK_ITEMS_PER_CATEGORY)
    .map((dish) => ({
      key: dish.slug,
      title: dish.title,
      description: dish.description,
      allergens: [...dish.allergens],
      isVegetarian: dish.tags.includes("vegetarian"),
    }));
}

export function buildLocalizedCatalogOverlay(menuLocale: MenuLocale): ProviderMenuCatalogSnapshot {
  const rows: ProviderLunchCategoryRow[] = EDITABLE_LUNCH_CATEGORY_KEYS.map((lunchKey) => {
    const fixedKey = LUNCH_CATEGORY_KEY_TO_FIXED_KEY[lunchKey];
    return {
      key: lunchKey,
      title: getLocalizedCategoryLabel(menuLocale, fixedKey),
      allowedPlanTiers: tierAccessForLunchKey(lunchKey),
      items: dishBankItemsForCategory(menuLocale, fixedKey),
    };
  });

  return { rows };
}

export function mergeCatalogWithLocalizedOverlay(
  baseCatalog: ProviderMenuCatalogSnapshot,
  overlay: ProviderMenuCatalogSnapshot,
): ProviderMenuCatalogSnapshot {
  const overlayByKey = new Map<string, ProviderLunchCategoryRow>();
  for (const row of overlay.rows) {
    const key = String(row.key ?? "").trim().toLowerCase();
    if (key) overlayByKey.set(key, row);
  }

  const mergedKeys = new Set<string>();
  const rows: ProviderLunchCategoryRow[] = [];

  for (const baseRow of baseCatalog.rows) {
    const key = String(baseRow.key ?? "").trim().toLowerCase();
    const overlayRow = key ? overlayByKey.get(key) : undefined;
    if (overlayRow) {
      mergedKeys.add(key);
      rows.push({
        ...baseRow,
        title: overlayRow.title ?? baseRow.title,
        allowedPlanTiers: baseRow.allowedPlanTiers ?? overlayRow.allowedPlanTiers,
        items: overlayRow.items ?? baseRow.items,
      });
    } else {
      rows.push(baseRow);
    }
  }

  for (const overlayRow of overlay.rows) {
    const key = String(overlayRow.key ?? "").trim().toLowerCase();
    if (!key || mergedKeys.has(key)) continue;
    rows.push(overlayRow);
  }

  return { rows };
}

export function buildLocalizedMenuSurfacePresentation(input: {
  providerId: string;
  settingsRow: ProviderSettingsMenuProfileRow | null;
  resolverResult: MenuProfileResolverResult | null | undefined;
  env?: EnvLike;
}): LocalizedMenuSurfacePresentation {
  if (!isLocalizedFixedMenuGeneratorEnabled(input.env ?? {})) {
    return { active: false };
  }

  if (!input.settingsRow) return { active: false };

  const runtimeProfile = resolveProviderMenuRuntimeProfile({
    providerId: input.providerId,
    country: input.settingsRow.defaultCountryCode,
    menuLocale: input.settingsRow.locale,
    menuProfileId: input.settingsRow.menuProfileId,
    currency: input.settingsRow.defaultCurrency,
    resolverResult: input.resolverResult,
  });

  const profile = getMenuProfile(runtimeProfile.menuProfileId);
  const categoryLabels = buildLocalizedRuntimeCategoryLabels(runtimeProfile.menuLocale);
  const catalogOverlay = buildLocalizedCatalogOverlay(runtimeProfile.menuLocale);

  return {
    active: true,
    menuLocale: runtimeProfile.menuLocale,
    menuProfileId: runtimeProfile.menuProfileId,
    profileName: profile.name,
    country: runtimeProfile.country,
    categoryLabels,
    catalogOverlay,
    fallbackWarning: runtimeProfile.fallbackWarning,
  };
}
