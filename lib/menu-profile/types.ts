/**
 * INERT MENU PROFILE TYPES — ADR-019 G0
 *
 * NOT FOR RUNTIME. Do not import from app/, app/api/, order/publish/billing paths
 * until explicit G1+ phase gate.
 */

export const MARKET_CODES = [
  "NO",
  "SE",
  "DK",
  "FI",
  "DE",
  "FR",
  "ES",
  "UK",
  "IT",
  "US",
  "CA",
  "NL",
  "BE",
  "AT",
  "CH",
  "IE",
  "LU",
  "AU",
  "SG",
] as const;
export type MarketCode = (typeof MARKET_CODES)[number];

export const CURRENCY_CODES = [`${"NO"}K`, "SEK", "DKK", "EUR", "GBP", "USD", "CAD", "CHF", "AUD", "SGD"] as const;
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
  "italian_office_lunch",
  "us_office_lunch",
  "canadian_office_lunch",
  "dutch_office_lunch",
  "belgian_dutch_office_lunch",
  "belgian_french_office_lunch",
  "austrian_office_lunch",
  "swiss_german_office_lunch",
  "swiss_french_office_lunch",
  "irish_office_lunch",
  "luxembourg_office_lunch",
  "australian_office_lunch",
  "singapore_office_lunch",
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

/** Canonical inert warm dish bank seed — ADR-019 G0.2. Not published menuDay documents. */
export type WarmDishBankSeed = {
  key: string;
  profileId: MenuProfileId;
  market: MarketCode;
  locale: string;
  title: string;
  description?: string;
  tags?: readonly string[];
  allergens?: readonly string[];
  dishType?: string;
  protein?: string;
  suitableForAutoPublish?: boolean;
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
  timezoneStrategy?: "fixed" | "provider_required";
  defaultTimezone?: string;
  defaultTimezoneForPilot?: string;
};

export type ResolveMenuProfileForProviderInput = {
  providerId?: string;
  market?: MarketCode | null;
  locale?: string | null;
  menuProfileId?: string | null;
  /** Env bag for flag read. Omit or empty = resolver disabled (default OFF). Runtime wiring passes host env later. */
  env?: Readonly<Record<string, string | undefined>>;
};

export type MenuProfileResolveSource =
  | "legacy_disabled"
  | "provider_setting"
  | "market_default"
  | "fallback_no_market";

export type MenuProfileResolverSuccess = {
  ok: true;
  enabled: boolean;
  source: MenuProfileResolveSource;
  profile: MenuProfile;
  warning?: string;
};

export type MenuProfileResolverError = {
  ok: false;
  enabled: true;
  reason: "unsupported_menu_profile";
  message: string;
};

export type MenuProfileResolverResult = MenuProfileResolverSuccess | MenuProfileResolverError;
