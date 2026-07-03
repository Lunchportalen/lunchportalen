/**
 * INERT MENU PROFILE MODULE — ADR-019 G0–G1
 *
 * Public exports for menu profile registry, market defaults, and G1 resolver.
 * Resolver is NOT wired to runtime routes until explicit cutover (flag default OFF).
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
  MenuProfileResolveSource,
  MenuProfileResolverError,
  MenuProfileResolverResult,
  MenuProfileResolverSuccess,
  PackageKey,
  ResolveMenuProfileForProviderInput,
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

export {
  isMenuProfileResolverEnabled,
  LP_MENU_PROFILE_RESOLVER_ENV,
  LP_MENU_PROFILE_FIXED_CATEGORIES_ENV,
  LP_MENU_PROFILE_WARM_DISH_PREVIEW_ENV,
  isMenuProfileWarmDishPreviewEnabled,
  isMenuProfileWarmDishPreviewPanelEnabled,
} from "@/lib/menu-profile/featureFlag";

export { resolveMenuProfileForProvider } from "@/lib/menu-profile/resolver";
export {
  providerCountryCodeToMarket,
  resolveProviderMenuProfileFromSettings,
} from "@/lib/menu-profile/providerMenuProfileResolver";
export type { ProviderSettingsMenuProfileInput } from "@/lib/menu-profile/providerMenuProfileResolver";

export {
  APP_LOCALE_MENU_PROFILE_MAPPINGS,
  isValidPersistedMenuProfileId,
  marketToDefaultCountryCode,
  resolveMarketMenuProfileFromProviderLocale,
  resolveMenuProfileIdFromAppLocale,
  resolveMenuProfileIdFromProviderLocale,
} from "@/lib/menu-profile/localeMenuProfileMapping";
export type { ProviderLocaleMarketMapping } from "@/lib/menu-profile/localeMenuProfileMapping";
