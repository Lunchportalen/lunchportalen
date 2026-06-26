/**
 * G5d.1 — Pure menu profile → runtime mapping types (shadow-only, not wired to runtime).
 */

import type { Category } from "@/lib/cms/menuDayContract";
import type { CurrencyCode, MarketCode, MenuProfileId, PackageKey } from "@/lib/menu-profile/types";

export const MENU_PROFILE_RUNTIME_MAPPING_VERSION = "g5d.1" as const;

export const MENU_PROFILE_RUNTIME_MAPPING_REASON_CODES = [
  "existing_no_runtime_mapping",
  "profile_key_not_runtime_supported",
  "warm_dish_preview_only",
  "enterprise_upgrade_not_order_category",
  "missing_runtime_mapping",
  "non_no_market_shadow_only",
] as const;

export type MenuProfileRuntimeMappingReasonCode =
  (typeof MENU_PROFILE_RUNTIME_MAPPING_REASON_CODES)[number];

export type MenuProfileRuntimeCategoryMapping = {
  profileCategoryKey: string;
  profileLabel: string;
  runtimeCategoryKey: Category | null;
  runtimeLunchCategoryKey: string | null;
  runtimeOrderChoiceKey: string | null;
  packageTiers: readonly PackageKey[];
  isMappedToExistingRuntime: boolean;
  isPresentationOnly: true;
  canSaveToMenuDay: false;
  canSaveToCatalog: false;
  canPublish: false;
  canOrder: false;
  reasonCode: MenuProfileRuntimeMappingReasonCode;
};

export type MenuProfileRuntimeWarmDishMapping = {
  warmDishPreviewId: string;
  profileId: MenuProfileId;
  title: string;
  runtimeCategoryKey: "varmrett" | null;
  runtimeOrderChoiceKey: "varmmat" | null;
  canApplyToMenu: false;
  canPublish: false;
  canOrder: false;
  isPreviewOnly: true;
  reasonCode: MenuProfileRuntimeMappingReasonCode;
};

export type MenuProfileRuntimeMapping = {
  profileId: MenuProfileId;
  market: MarketCode;
  locale: string;
  currency: CurrencyCode;
  categories: readonly MenuProfileRuntimeCategoryMapping[];
  warmDishPreview: readonly MenuProfileRuntimeWarmDishMapping[];
  mappingVersion: typeof MENU_PROFILE_RUNTIME_MAPPING_VERSION;
  isRuntimeEnabled: false;
  isShadowOnly: true;
};
