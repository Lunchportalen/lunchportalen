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
  LP_LOCALIZED_GENERATOR_SOT_ENABLED_ENV,
  LP_LOCALIZED_GENERATOR_SOT_PROVIDER_ALLOWLIST_ENV,
  LP_LOCALIZED_GENERATOR_SOT_DRY_RUN_ENV,
  LP_LOCALIZED_GENERATOR_AUTO_ROLLOUT_ENABLED_ENV,
  isLocalizedGeneratorSotEnabled,
  isLocalizedGeneratorSotDryRunEnabled,
  isLocalizedGeneratorAutoRolloutEnabled,
  parseLocalizedGeneratorSotProviderAllowlist,
  isProviderInLocalizedGeneratorSotAllowlist,
  isLocalizedGeneratorSotEligibleForProvider,
} from "@/lib/menu-generator/sotFeatureFlag";

export {
  LOCALIZED_GENERATOR_SOT_PHASE,
  LOCALIZED_GENERATOR_SOT_V1_MSDI_SNAPSHOT_MODE,
  resolveLocalizedGeneratorSotDecision,
  toLocalizedGeneratorSotOpsLogPayload,
} from "@/lib/menu-generator/localizedGeneratorSotResolver";
export type {
  LocalizedGeneratorSotDecision,
  LocalizedGeneratorSotDecisionReason,
  LocalizedGeneratorSotResolverInput,
  LocalizedGeneratorSotSelectedSource,
} from "@/lib/menu-generator/localizedGeneratorSotResolver";

export {
  buildLocalizedGeneratorSotInactiveControl,
  buildLocalizedGeneratorSotProviderControl,
  toLocalizedGeneratorSotControlOpsLog,
} from "@/lib/menu-generator/localizedGeneratorSotControl";
export type {
  LocalizedGeneratorSotControlStatus,
  LocalizedGeneratorSotRuntimeControl,
} from "@/lib/menu-generator/localizedGeneratorSotControl";

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
  APPLY_CATEGORY_SCOPES,
  DEFAULT_APPLY_OVERWRITE_MODE,
  DEFAULT_APPLY_CATEGORY_SCOPE,
  buildApplyIdempotencyKey,
  isSupportedApplyMenuLocale,
} from "@/lib/menu-generator/applyTypes";
export type {
  ApplyCategoryScope,
  ApplyErrorCode,
  ApplyLocalizedGeneratedWeekMenuInput,
  ApplyLocalizedGeneratedWeekMenuResult,
  ApplyOverwriteMode,
} from "@/lib/menu-generator/applyTypes";

export { resolveMenuApplyCapabilities, lunchCategoryKeyForFixed } from "@/lib/menu-generator/applyCapabilities";
export type { MenuApplyCapabilities, CategoryApplyCapability } from "@/lib/menu-generator/applyCapabilities";

export { buildFullLocalizedWeekMenuDraft } from "@/lib/menu-generator/fullApplyDomain";
export type { FullLocalizedGeneratedWeekMenuDraft, FullApplyMenuItem } from "@/lib/menu-generator/fullApplyDomain";

export { buildFullApplyDiff, fullApplyWouldMutate } from "@/lib/menu-generator/fullApplyDiff";
export type { FullApplySummary, FullApplyCategoryDiff, FullApplyDayDiff } from "@/lib/menu-generator/fullApplyDiff";

export { applyCatalogCategories } from "@/lib/menu-generator/fullApplyWrite";

export {
  buildApplyWeekDiff,
  summarizeApplyDays,
  dryRunSummaryFromDays,
  wouldMutateInDryRun,
} from "@/lib/menu-generator/applyWeekMenuDiff";
export type { ApplyGeneratedVarmrettState, VarmrettDayDiff } from "@/lib/menu-generator/applyWeekMenuDiff";

export { mapGeneratedWeekToApplyTargets, enterpriseHotMealIdentityStable } from "@/lib/menu-generator/applyWeekMenuMapper";
export { formatAllergensForMenuDay, formatAllergensForCatalog } from "@/lib/menu-generator/allergenMenuDayFormat";
export { applyLocalizedGeneratedWeekMenu, parseApplyLocalizedGeneratedWeekMenuBody } from "@/lib/menu-generator/applyLocalizedGeneratedWeekMenu";
