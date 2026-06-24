/**
 * INERT MENU PROFILE MODULE — ADR-019 G0
 *
 * Public exports for menu profile registry and market defaults.
 * NOT FOR RUNTIME until G1+ phase gate.
 */

export type {
  AutoPublishRuleSet,
  CurrencyCode,
  EnterpriseUpgradeDefinition,
  MarketCode,
  MarketDefaults,
  MenuCategoryDefinition,
  MenuCategoryKind,
  MenuPackageDefinition,
  MenuProfile,
  MenuProfileId,
  MenuProfilePackageModel,
  PackageKey,
  WarmDishBankSeed,
  WarmDishDefinition,
  WarmDishRuleSet,
} from "@/lib/menu-profile/types";

export {
  CURRENCY_CODES,
  MARKET_CODES,
  MENU_PROFILE_IDS,
  PACKAGE_KEYS,
} from "@/lib/menu-profile/types";

export {
  assertMenuProfile,
  getMenuProfile,
  isSupportedMenuProfile,
  listMenuProfiles,
  MENU_PROFILE_REGISTRY,
} from "@/lib/menu-profile/registry";

export {
  getDefaultMenuProfileForMarket,
  getMarketDefaults,
  MARKET_DEFAULTS,
} from "@/lib/menu-profile/marketDefaults";

export {
  assertWarmDishBankSeed,
  getWarmDishBankSeedsForMarket,
  getWarmDishBankSeedsForProfile,
  listWarmDishBankSeeds,
  toWarmDishDefinition,
  warmDishDefinitionsForProfile,
  WARM_DISH_BANK_SEEDS,
} from "@/lib/menu-profile/warmDishBankSeeds";
