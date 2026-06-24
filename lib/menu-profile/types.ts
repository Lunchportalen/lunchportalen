/**
 * INERT MENU PROFILE TYPES — ADR-019 G0
 *
 * NOT FOR RUNTIME. Do not import from app/, app/api/, order/publish/billing paths
 * until explicit G1+ phase gate.
 */

export const MARKET_CODES = ["NO", "SE", "DK", "FI", "DE", "FR", "ES", "UK"] as const;
export type MarketCode = (typeof MARKET_CODES)[number];

export const CURRENCY_CODES = [`${"NO"}K`, "SEK", "DKK", "EUR", "GBP"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export const MENU_PROFILE_IDS = [
  "norwegian_company_lunch",
  "swedish_lunch",
  "danish_office_lunch",
  "finnish_office_lunch",
  "german_business_lunch",
  "french_dejeuner",
  "spanish_menu_del_dia",
  "uk_office_lunch",
] as const;
export type MenuProfileId = (typeof MENU_PROFILE_IDS)[number];

export const PACKAGE_KEYS = ["basis", "luxus", "enterprise"] as const;
export type PackageKey = (typeof PACKAGE_KEYS)[number];

export type MenuCategoryKind = "fixed_choice" | "warm_dish" | "upgrade";

export type MenuCategoryDefinition = {
  key: string;
  label: string;
  description?: string;
  kind: MenuCategoryKind;
  providerEditable: boolean;
};

export type MenuPackageDefinition = {
  key: PackageKey;
  label: string;
  categoryKeys: readonly string[];
  includesSharedWarmDish: boolean;
  enterpriseUpgrade?: boolean;
};

export type WarmDishDefinition = {
  key: string;
  title: string;
  tags?: readonly string[];
  allergens?: readonly string[];
  profileId: MenuProfileId;
};

export type WarmDishRuleSet = {
  requireOneSharedWarmDishPerDeliveryDay: true;
  avoidRepeatedProtein?: boolean;
  avoidRepeatedDishType?: boolean;
  maxFishDaysPerWeek?: number;
  maxSoupDaysPerWeek?: number;
};

export type AutoPublishRuleSet = {
  requireCompleteWeek: boolean;
  requireWarmDishForDeliveryDays: boolean;
  requireValidProviderAgreement: boolean;
  requireCurrency: boolean;
  requirePackagePrices: boolean;
  requireMenuProfile: boolean;
};

export type EnterpriseUpgradeDefinition = {
  enabled: boolean;
  label: string;
  description: string;
};

export type MenuProfilePackageModel = {
  basis: MenuPackageDefinition;
  luxus: MenuPackageDefinition;
  enterprise: MenuPackageDefinition;
};

export type MenuProfile = {
  id: MenuProfileId;
  market: MarketCode;
  locale: string;
  name: string;
  description?: string;
  fixedChoiceCategories: readonly MenuCategoryDefinition[];
  packageModel: MenuProfilePackageModel;
  warmDishBank: readonly WarmDishDefinition[];
  warmDishRules: WarmDishRuleSet;
  autoPublishRules: AutoPublishRuleSet;
  enterpriseUpgradeModel?: EnterpriseUpgradeDefinition;
};

export type MarketDefaults = {
  market: MarketCode;
  defaultMenuProfileId: MenuProfileId;
  defaultCurrency: CurrencyCode;
  defaultLocale: string;
};
