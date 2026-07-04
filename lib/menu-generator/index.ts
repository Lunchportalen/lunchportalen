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
