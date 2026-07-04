import { resolveEconomyConfigForCountry } from "@/lib/menu-generator/countryEconomyDefaults";
import {
  assessFixedDishBankStatus,
  getFixedDishBankForLocale,
  resolveMenuLocale,
} from "@/lib/menu-generator/localizedFixedDishBanks";
import type { ProviderMenuRuntimeProfile } from "@/lib/menu-generator/types";
import { FIXED_CATEGORY_KEYS } from "@/lib/menu-generator/types";
import { providerCountryCodeToMarket } from "@/lib/menu-profile/providerMenuProfileResolver";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import { resolveMarketMenuProfileFromProviderLocale } from "@/lib/menu-profile/localeMenuProfileMapping";
import type { MenuProfileId, MenuProfileResolverResult } from "@/lib/menu-profile/types";
import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";

export type ResolveProviderMenuRuntimeProfileInput = {
  providerId: string;
  country?: string | null;
  menuLocale?: string | null;
  menuProfileId?: string | null;
  currency?: string | null;
  resolverResult?: MenuProfileResolverResult | null;
  /** Employee UI locale — NEVER used for dish bank selection. */
  employeeLocale?: string | null;
};

function resolveProfileId(input: ResolveProviderMenuRuntimeProfileInput): MenuProfileId {
  if (input.menuProfileId) {
    return input.menuProfileId as MenuProfileId;
  }
  if (input.resolverResult?.ok && input.resolverResult.enabled) {
    return input.resolverResult.profile.id;
  }
  const country = String(input.country ?? "NO").trim().toUpperCase();
  const market = providerCountryCodeToMarket(country) ?? "NO";
  return getMarketDefaults(market).defaultMenuProfileId;
}

export function resolveProviderMenuRuntimeProfile(
  input: ResolveProviderMenuRuntimeProfileInput,
): ProviderMenuRuntimeProfile {
  const providerId = String(input.providerId ?? "").trim();
  const country = String(input.country ?? "NO").trim().toUpperCase() || "NO";
  const market = providerCountryCodeToMarket(country) ?? "NO";
  const marketDefaults = getMarketDefaults(market);

  const profileId = resolveProfileId(input);
  const profile =
    input.resolverResult?.ok && input.resolverResult.enabled
      ? input.resolverResult.profile
      : getMenuProfile(profileId);

  const localeResolution = resolveMenuLocale({
    menuLocale: input.menuLocale ?? profile.locale,
    profileLocale: profile.locale,
  });

  const currency =
    (input.currency as ProviderMenuRuntimeProfile["currency"] | undefined) ??
    marketDefaults.defaultCurrency;

  const economyConfig = resolveEconomyConfigForCountry(country);
  const fixedDishBank = getFixedDishBankForLocale(localeResolution.menuLocale);
  const bankStatus = assessFixedDishBankStatus(localeResolution.menuLocale);

  const fallbackWarning = localeResolution.usedFallback
    ? `menuLocale fallback to ${localeResolution.menuLocale} — provider profile incomplete.`
    : !bankStatus.meetsMinimums
      ? `Fixed dish bank for ${localeResolution.menuLocale} below minimum counts.`
      : input.resolverResult?.ok && input.resolverResult.warning
        ? input.resolverResult.warning
        : null;

  if (localeResolution.usedFallback && typeof console !== "undefined") {
    console.warn(
      `[menu-generator] locale fallback for provider ${providerId}: ${localeResolution.menuLocale}`,
    );
  }

  void input.employeeLocale;

  return {
    providerId,
    country,
    market,
    menuLocale: localeResolution.menuLocale,
    language: localeResolution.menuLocale.split("-")[0] ?? "nb",
    currency,
    vatRate: economyConfig.vatRate,
    menuProfileId: profileId,
    packageModel: ["basis", "luxus", "enterprise"],
    enabledCategories: FIXED_CATEGORY_KEYS.filter((key) =>
      fixedDishBank.some((d) => d.categoryKey === key),
    ),
    fixedDishBank,
    economyConfig: { ...economyConfig, currency },
    usedFallback: localeResolution.usedFallback,
    fallbackWarning,
  };
}

export function resolveProviderMenuRuntimeProfileFromOperationalLocale(input: {
  providerId: string;
  operationalLocale: string;
  country?: string | null;
  menuProfileId?: string | null;
  currency?: string | null;
  employeeLocale?: string | null;
}): ProviderMenuRuntimeProfile {
  const mapping = resolveMarketMenuProfileFromProviderLocale(input.operationalLocale);
  return resolveProviderMenuRuntimeProfile({
    providerId: input.providerId,
    country: input.country ?? mapping.defaultCountryCode,
    menuLocale: mapping.intlLocale,
    menuProfileId: input.menuProfileId ?? mapping.menuProfileId,
    currency: input.currency ?? mapping.defaultCurrency,
    employeeLocale: input.employeeLocale,
  });
}
