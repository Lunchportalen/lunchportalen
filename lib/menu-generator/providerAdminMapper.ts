import type {
  GeneratedMenuChoiceInternal,
  GeneratedProviderWeekMenu,
  ProviderAdminMenuChoice,
  ProviderMenuRuntimeProfile,
} from "@/lib/menu-generator/types";
import { assessFixedDishBankStatus } from "@/lib/menu-generator/localizedFixedDishBanks";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";

function toProviderChoice(choice: GeneratedMenuChoiceInternal): ProviderAdminMenuChoice {
  return {
    dayIndex: choice.dayIndex,
    date: choice.date,
    categoryKey: choice.categoryKey,
    tier: choice.tier,
    itemKey: choice.itemKey,
    choiceKey: choice.choiceKey,
    slug: choice.slug,
    title: choice.title,
    description: choice.description,
    allergens: choice.allergens,
    tags: choice.tags,
    hotMealBaseItemKey: choice.hotMealBaseItemKey,
    isPremiumUpgrade: choice.isPremiumUpgrade,
    economy: choice.economy ?? {
      providerCost: 0,
      currency: getMarketDefaults("NO").defaultCurrency,
      vatRate: 0,
    },
  };
}

export type ProviderAdminWeekMenu = {
  profile: {
    providerId: string;
    country: string;
    menuLocale: string;
    menuProfileId: string;
    currency: string;
    vatRate: number;
    enabledCategories: readonly string[];
    fixedDishBankStatus: ReturnType<typeof assessFixedDishBankStatus>;
    economySummary: {
      currency: string;
      vatRate: number;
      marginTarget: number;
      packagePriceRules: ProviderMenuRuntimeProfile["economyConfig"]["packagePriceRules"];
    };
    fallbackWarning: string | null;
  };
  weekStart: string;
  packageTier: string;
  days: readonly {
    dayIndex: number;
    date: string;
    choices: readonly ProviderAdminMenuChoice[];
  }[];
};

export function mapGeneratedWeekMenuToProviderAdmin(
  menu: GeneratedProviderWeekMenu,
  runtimeProfile: ProviderMenuRuntimeProfile,
): ProviderAdminWeekMenu {
  return {
    profile: {
      providerId: runtimeProfile.providerId,
      country: runtimeProfile.country,
      menuLocale: runtimeProfile.menuLocale,
      menuProfileId: runtimeProfile.menuProfileId,
      currency: runtimeProfile.currency,
      vatRate: runtimeProfile.vatRate,
      enabledCategories: runtimeProfile.enabledCategories,
      fixedDishBankStatus: assessFixedDishBankStatus(runtimeProfile.menuLocale),
      economySummary: {
        currency: runtimeProfile.economyConfig.currency,
        vatRate: runtimeProfile.economyConfig.vatRate,
        marginTarget: runtimeProfile.economyConfig.marginTarget,
        packagePriceRules: runtimeProfile.economyConfig.packagePriceRules,
      },
      fallbackWarning: runtimeProfile.fallbackWarning,
    },
    weekStart: menu.weekStart,
    packageTier: menu.packageTier,
    days: menu.days.map((day) => ({
      dayIndex: day.dayIndex,
      date: day.date,
      choices: day.choices.map(toProviderChoice),
    })),
  };
}
