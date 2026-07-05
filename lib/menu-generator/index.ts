export type {
  AllergenCode,
  EconomyConfig,
  EmployeeSafeMenuChoice,
  FixedCategoryKey,
  FixedDishDefinition,
  GeneratedMenuChoiceInternal,
  GeneratedProviderWeekMenu,
  GenerateProviderWeekMenuInput,
  MenuLocale,
  ProviderAdminMenuChoice,
  ProviderMenuRuntimeProfile,
} from "@/lib/menu-generator/types";

export {
  CANONICAL_ALLERGENS,
  normalizeAllergens,
} from "@/lib/menu-generator/allergens";

export {
  LP_LOCALIZED_FIXED_MENU_GENERATOR_ENV,
  isLocalizedFixedMenuGeneratorEnabled,
  isLocalizedFixedMenuGeneratorPanelEnabled,
} from "@/lib/menu-generator/featureFlag";

export {
  resolveEconomyConfigForCountry,
  resolveEconomyConfigForMarket,
} from "@/lib/menu-generator/countryEconomyDefaults";

export {
  buildSelectionSeed,
  deterministicIndex,
  hashStringToUint32,
} from "@/lib/menu-generator/deterministicHash";

export {
  buildStableChoiceKey,
  buildStableItemKey,
} from "@/lib/menu-generator/itemKeys";

export {
  assessFixedDishBankStatus,
  getFixedDishBankForLocale,
  getFixedDishesByCategory,
  isSupportedMenuLocale,
  resolveMenuLocale,
} from "@/lib/menu-generator/localizedFixedDishBanks";

export {
  resolveProviderMenuRuntimeProfile,
  resolveProviderMenuRuntimeProfileFromOperationalLocale,
} from "@/lib/menu-generator/resolveProviderMenuRuntimeProfile";

export {
  categoriesForTier,
  isEnterprisePremiumUpgradeCategory,
  tierIncludesCategory,
} from "@/lib/menu-generator/tierRules";

export { generateProviderWeekMenu } from "@/lib/menu-generator/generateProviderWeekMenu";

export {
  assertEmployeeSafePayload,
  mapGeneratedWeekMenuToEmployeeSafe,
  EMPLOYEE_FORBIDDEN_KEYS,
} from "@/lib/menu-generator/employeeSafeMapper";
export type { EmployeeSafeWeekMenu } from "@/lib/menu-generator/employeeSafeMapper";

export {
  mapGeneratedWeekMenuToProviderAdmin,
} from "@/lib/menu-generator/providerAdminMapper";
export type { ProviderAdminWeekMenu } from "@/lib/menu-generator/providerAdminMapper";

export { ALL_LOCALE_BANKS } from "@/lib/menu-generator/dishBanks/localeData";

export {
  buildLocalizedRuntimeCategoryLabels,
  buildPackageCardMenuTerms,
  getLocalizedCategoryLabel,
  getLocalizedCategoryLabels,
  LUNCH_CATEGORY_KEY_TO_FIXED_KEY,
  RUNTIME_CATEGORY_TO_FIXED_KEY,
} from "@/lib/menu-generator/localizedCategoryLabels";
export type { PackageCardMenuTerms } from "@/lib/menu-generator/localizedCategoryLabels";

export {
  buildLocalizedCatalogOverlay,
  buildLocalizedMenuSurfacePresentation,
  mergeCatalogWithLocalizedOverlay,
} from "@/lib/menu-generator/localizedMenuSurface";
export type { LocalizedMenuSurfacePresentation } from "@/lib/menu-generator/localizedMenuSurface";

export {
  LOCALIZED_MENU_GENERATOR_VERSION,
  APPLY_OVERWRITE_MODES,
  DEFAULT_APPLY_OVERWRITE_MODE,
  buildApplyIdempotencyKey,
  isSupportedApplyMenuLocale,
} from "@/lib/menu-generator/applyTypes";
export type {
  ApplyDayDiff,
  ApplyDayStatus,
  ApplyErrorCode,
  ApplyLocalizedGeneratedWeekMenuInput,
  ApplyLocalizedGeneratedWeekMenuResult,
  ApplyOverwriteMode,
  ApplySummary,
} from "@/lib/menu-generator/applyTypes";

export { buildApplyWeekDiff, dryRunSummaryFromDays, summarizeApplyDays, wouldMutateInDryRun } from "@/lib/menu-generator/applyWeekMenuDiff";
export { mapGeneratedWeekToApplyTargets, enterpriseHotMealIdentityStable } from "@/lib/menu-generator/applyWeekMenuMapper";
export { formatAllergensForMenuDay } from "@/lib/menu-generator/allergenMenuDayFormat";
export { applyLocalizedGeneratedWeekMenu, parseApplyLocalizedGeneratedWeekMenuBody } from "@/lib/menu-generator/applyLocalizedGeneratedWeekMenu";
