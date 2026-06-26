/**
 * G5d.1 — Pure menu profile → runtime mapping layer (shadow-only).
 *
 * Builds an explicit mapping model for future G5d cutover. NOT imported by save/publish/order/week/Sanity runtime.
 */

import {
  resolveNoCategoryRuntimeMapping,
  type NoCategoryRuntimeMapping,
} from "@/lib/menu-profile/noCategoryRuntimeMap";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";
import type {
  CurrencyCode,
  MenuCategoryDefinition,
  MenuProfile,
  MenuProfileId,
  PackageKey,
} from "@/lib/menu-profile/types";
import {
  MENU_PROFILE_RUNTIME_MAPPING_VERSION,
  type MenuProfileRuntimeCategoryMapping,
  type MenuProfileRuntimeMapping,
  type MenuProfileRuntimeMappingReasonCode,
  type MenuProfileRuntimeWarmDishMapping,
} from "@/lib/menu-profile/runtimeMappingTypes";

export type {
  MenuProfileRuntimeCategoryMapping,
  MenuProfileRuntimeMapping,
  MenuProfileRuntimeMappingReasonCode,
  MenuProfileRuntimeWarmDishMapping,
} from "@/lib/menu-profile/runtimeMappingTypes";

export {
  MENU_PROFILE_RUNTIME_MAPPING_REASON_CODES,
  MENU_PROFILE_RUNTIME_MAPPING_VERSION,
} from "@/lib/menu-profile/runtimeMappingTypes";

export const WARM_DISH_PREVIEW_ID_PREFIX = "warm-dish-preview:" as const;

export type WarmDishPreviewMappingInput = {
  id: string;
  title: string;
};

export type NoCategoryRuntimeMapResolver = (
  profileCategoryKey: string,
) => NoCategoryRuntimeMapping | null;

export type BuildMenuProfileRuntimeMappingInput = {
  menuProfile: MenuProfile;
  currency?: CurrencyCode;
  warmDishPreview?: readonly WarmDishPreviewMappingInput[];
  noRuntimeMap?: NoCategoryRuntimeMapResolver;
};

const SHADOW_ONLY_CATEGORY = {
  isPresentationOnly: true as const,
  canSaveToMenuDay: false as const,
  canSaveToCatalog: false as const,
  canPublish: false as const,
  canOrder: false as const,
};

const SHADOW_ONLY_WARM_DISH = {
  canApplyToMenu: false as const,
  canPublish: false as const,
  canOrder: false as const,
  isPreviewOnly: true as const,
};

function packageTiersForCategory(profile: MenuProfile, categoryKey: string): readonly PackageKey[] {
  const tiers: PackageKey[] = [];
  const { basis, luxus, enterprise } = profile.packageModel;
  if (basis.categoryKeys.includes(categoryKey)) tiers.push("basis");
  if (luxus.categoryKeys.includes(categoryKey)) tiers.push("luxus");
  if (enterprise.categoryKeys.includes(categoryKey)) tiers.push("enterprise");
  return tiers;
}

function buildWarmDishPreviewId(profileId: MenuProfileId, seedKey: string): string {
  return `${WARM_DISH_PREVIEW_ID_PREFIX}${profileId}:${seedKey}`;
}

function resolveCategoryReasonCode(
  market: MenuProfile["market"],
  category: MenuCategoryDefinition,
  noMapping: NoCategoryRuntimeMapping | null,
): MenuProfileRuntimeMappingReasonCode {
  if (category.key === "enterprise_upgrade" || category.kind === "upgrade") {
    return "enterprise_upgrade_not_order_category";
  }
  if (market !== "NO") {
    return "non_no_market_shadow_only";
  }
  if (noMapping) {
    return "existing_no_runtime_mapping";
  }
  return "missing_runtime_mapping";
}

function mapCategoryDefinition(
  profile: MenuProfile,
  category: MenuCategoryDefinition,
  resolveNoMapping: NoCategoryRuntimeMapResolver,
): MenuProfileRuntimeCategoryMapping {
  const noMapping = profile.market === "NO" ? resolveNoMapping(category.key) : null;
  const reasonCode = resolveCategoryReasonCode(profile.market, category, noMapping);

  if (category.key === "enterprise_upgrade" || category.kind === "upgrade") {
    return {
      profileCategoryKey: category.key,
      profileLabel: category.label,
      runtimeCategoryKey: null,
      runtimeLunchCategoryKey: null,
      runtimeOrderChoiceKey: null,
      packageTiers: packageTiersForCategory(profile, category.key),
      isMappedToExistingRuntime: false,
      reasonCode,
      ...SHADOW_ONLY_CATEGORY,
    };
  }

  if (profile.market !== "NO") {
    return {
      profileCategoryKey: category.key,
      profileLabel: category.label,
      runtimeCategoryKey: null,
      runtimeLunchCategoryKey: null,
      runtimeOrderChoiceKey: null,
      packageTiers: packageTiersForCategory(profile, category.key),
      isMappedToExistingRuntime: false,
      reasonCode,
      ...SHADOW_ONLY_CATEGORY,
    };
  }

  if (noMapping) {
    return {
      profileCategoryKey: category.key,
      profileLabel: category.label,
      runtimeCategoryKey: noMapping.runtimeCategoryKey,
      runtimeLunchCategoryKey: noMapping.runtimeLunchCategoryKey,
      runtimeOrderChoiceKey: noMapping.runtimeOrderChoiceKey,
      packageTiers: packageTiersForCategory(profile, category.key),
      isMappedToExistingRuntime: true,
      reasonCode,
      ...SHADOW_ONLY_CATEGORY,
    };
  }

  return {
    profileCategoryKey: category.key,
    profileLabel: category.label,
    runtimeCategoryKey: null,
    runtimeLunchCategoryKey: null,
    runtimeOrderChoiceKey: null,
    packageTiers: packageTiersForCategory(profile, category.key),
    isMappedToExistingRuntime: false,
    reasonCode,
    ...SHADOW_ONLY_CATEGORY,
  };
}

function mapWarmDishPreviewItem(
  profile: MenuProfile,
  item: WarmDishPreviewMappingInput,
): MenuProfileRuntimeWarmDishMapping {
  const isNoMarket = profile.market === "NO";
  return {
    warmDishPreviewId: item.id,
    profileId: profile.id,
    title: item.title,
    runtimeCategoryKey: isNoMarket ? "varmrett" : null,
    runtimeOrderChoiceKey: isNoMarket ? "varmmat" : null,
    reasonCode: isNoMarket ? "warm_dish_preview_only" : "non_no_market_shadow_only",
    ...SHADOW_ONLY_WARM_DISH,
  };
}

function defaultWarmDishPreviewItems(profile: MenuProfile): WarmDishPreviewMappingInput[] {
  return profile.warmDishBank.map((seed) => ({
    id: buildWarmDishPreviewId(profile.id, seed.key),
    title: seed.title,
  }));
}

/** Builds a shadow-only runtime mapping model for a menu profile. Does not enable runtime cutover. */
export function buildMenuProfileRuntimeMapping(
  input: BuildMenuProfileRuntimeMappingInput,
): MenuProfileRuntimeMapping {
  const { menuProfile } = input;
  const resolveNoMapping = input.noRuntimeMap ?? resolveNoCategoryRuntimeMapping;
  const currency =
    input.currency ?? getMarketDefaults(menuProfile.market).defaultCurrency;
  const warmDishItems = input.warmDishPreview ?? defaultWarmDishPreviewItems(menuProfile);

  return {
    profileId: menuProfile.id,
    market: menuProfile.market,
    locale: menuProfile.locale,
    currency,
    categories: menuProfile.fixedChoiceCategories.map((category) =>
      mapCategoryDefinition(menuProfile, category, resolveNoMapping),
    ),
    warmDishPreview: warmDishItems.map((item) => mapWarmDishPreviewItem(menuProfile, item)),
    mappingVersion: MENU_PROFILE_RUNTIME_MAPPING_VERSION,
    isRuntimeEnabled: false,
    isShadowOnly: true,
  };
}

/** Maps a single profile category key to its shadow runtime mapping entry. Fail-closed for unknown keys. */
export function mapProfileCategoryToRuntime(
  profileId: MenuProfileId,
  profileCategoryKey: string,
  options?: { noRuntimeMap?: NoCategoryRuntimeMapResolver },
): MenuProfileRuntimeCategoryMapping {
  const profile = getMenuProfile(profileId);
  const category = profile.fixedChoiceCategories.find((c) => c.key === profileCategoryKey);

  if (!category) {
    return {
      profileCategoryKey,
      profileLabel: profileCategoryKey,
      runtimeCategoryKey: null,
      runtimeLunchCategoryKey: null,
      runtimeOrderChoiceKey: null,
      packageTiers: [],
      isMappedToExistingRuntime: false,
      reasonCode: "missing_runtime_mapping",
      ...SHADOW_ONLY_CATEGORY,
    };
  }

  return mapCategoryDefinition(
    profile,
    category,
    options?.noRuntimeMap ?? resolveNoCategoryRuntimeMapping,
  );
}

/** True when a NO profile category has an existing runtime key mapping (informational only in G5d.1). */
export function isProfileCategoryRuntimeMapped(
  profileId: MenuProfileId,
  profileCategoryKey: string,
  options?: { noRuntimeMap?: NoCategoryRuntimeMapResolver },
): boolean {
  const mapping = mapProfileCategoryToRuntime(profileId, profileCategoryKey, options);
  return mapping.isMappedToExistingRuntime;
}

/** All G5d.1 mappings are shadow-only; returns true for known profile categories. */
export function isProfileCategoryShadowOnly(
  profileId: MenuProfileId,
  profileCategoryKey: string,
): boolean {
  const profile = getMenuProfile(profileId);
  return profile.fixedChoiceCategories.some((c) => c.key === profileCategoryKey);
}

/** Throws when any mapping entry accidentally enables runtime cutover. */
export function assertNoRuntimeEnablement(mapping: MenuProfileRuntimeMapping): void {
  if (mapping.isRuntimeEnabled) {
    throw new Error("MenuProfileRuntimeMapping.isRuntimeEnabled must remain false in G5d.1");
  }
  if (!mapping.isShadowOnly) {
    throw new Error("MenuProfileRuntimeMapping.isShadowOnly must remain true in G5d.1");
  }

  for (const category of mapping.categories) {
    if (category.canSaveToMenuDay) {
      throw new Error(
        `Category ${category.profileCategoryKey}: canSaveToMenuDay must remain false in G5d.1`,
      );
    }
    if (category.canSaveToCatalog) {
      throw new Error(
        `Category ${category.profileCategoryKey}: canSaveToCatalog must remain false in G5d.1`,
      );
    }
    if (category.canPublish) {
      throw new Error(
        `Category ${category.profileCategoryKey}: canPublish must remain false in G5d.1`,
      );
    }
    if (category.canOrder) {
      throw new Error(`Category ${category.profileCategoryKey}: canOrder must remain false in G5d.1`);
    }
  }

  for (const warmDish of mapping.warmDishPreview) {
    if (warmDish.canApplyToMenu) {
      throw new Error(`Warm dish ${warmDish.warmDishPreviewId}: canApplyToMenu must remain false in G5d.1`);
    }
    if (warmDish.canPublish) {
      throw new Error(`Warm dish ${warmDish.warmDishPreviewId}: canPublish must remain false in G5d.1`);
    }
    if (warmDish.canOrder) {
      throw new Error(`Warm dish ${warmDish.warmDishPreviewId}: canOrder must remain false in G5d.1`);
    }
    if (!warmDish.isPreviewOnly) {
      throw new Error(`Warm dish ${warmDish.warmDishPreviewId}: isPreviewOnly must remain true in G5d.1`);
    }
  }
}

/** Lists profile categories without an existing NO runtime mapping (excludes enterprise upgrade). */
export function listUnmappedProfileCategories(
  mapping: MenuProfileRuntimeMapping,
): readonly MenuProfileRuntimeCategoryMapping[] {
  return mapping.categories.filter(
    (category) =>
      !category.isMappedToExistingRuntime &&
      category.reasonCode !== "enterprise_upgrade_not_order_category",
  );
}

/** Lists NO profile categories mapped to existing runtime keys (informational shadow mapping). */
export function listMappedNoCategories(
  mapping: MenuProfileRuntimeMapping,
): readonly MenuProfileRuntimeCategoryMapping[] {
  if (mapping.market !== "NO") return [];
  return mapping.categories.filter((category) => category.isMappedToExistingRuntime);
}
