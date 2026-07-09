import { describe, expect, it } from "vitest";

import { APP_LOCALES, intlLocaleForAppLocale } from "@/lib/i18n/localeRegistry";
import { MARKET_DEFAULTS } from "@/lib/menu-profile/marketDefaults";
import {
  APP_LOCALE_MENU_PROFILE_MAPPINGS,
  isValidPersistedMenuProfileId,
  marketToDefaultCountryCode,
  resolveMarketMenuProfileFromProviderLocale,
  resolveMenuProfileIdFromAppLocale,
  resolveMenuProfileIdFromProviderLocale,
} from "@/lib/menu-profile/localeMenuProfileMapping";
import { isSupportedMenuProfile } from "@/lib/menu-profile/registry";

describe("localeMenuProfileMapping — all nine app locales", () => {
  it("maps each APP_LOCALE to a valid registry menu_profile_id", () => {
    expect(APP_LOCALE_MENU_PROFILE_MAPPINGS).toHaveLength(9);

    for (const mapping of APP_LOCALE_MENU_PROFILE_MAPPINGS) {
      expect(APP_LOCALES).toContain(mapping.appLocale);
      expect(mapping.usedFallback).toBe(false);
      expect(isSupportedMenuProfile(mapping.menuProfileId)).toBe(true);
      expect(isValidPersistedMenuProfileId(mapping.menuProfileId)).toBe(true);
    }
  });

  it("maps each intl locale to marketDefaults.defaultMenuProfileId", () => {
    for (const appLocale of APP_LOCALES) {
      const intl = intlLocaleForAppLocale(appLocale);
      const resolved = resolveMarketMenuProfileFromProviderLocale(intl);
      const market = Object.values(MARKET_DEFAULTS).find((m) => m.defaultLocale === intl);
      expect(market, `missing market for ${intl}`).toBeTruthy();
      expect(resolved.menuProfileId).toBe(market!.defaultMenuProfileId);
      expect(resolved.defaultCurrency).toBe(market!.defaultCurrency);
      expect(resolved.defaultCountryCode).toBe(marketToDefaultCountryCode(market!.market));
    }
  });

  it("resolveMenuProfileIdFromAppLocale covers nb da de en es fr it fi sv", () => {
    const expected: Record<(typeof APP_LOCALES)[number], string> = {
      nb: "norwegian_company_lunch",
      da: "danish_office_lunch",
      de: "german_business_lunch",
      en: "uk_office_lunch",
      es: "spanish_menu_del_dia",
      fr: "french_dejeuner",
      it: "italian_office_lunch",
      fi: "finnish_office_lunch",
      sv: "swedish_lunch",
    };

    for (const appLocale of APP_LOCALES) {
      expect(resolveMenuProfileIdFromAppLocale(appLocale)).toBe(expected[appLocale]);
    }
  });
});

describe("localeMenuProfileMapping — fallback safety", () => {
  it("unknown locale falls back to Norwegian profile without throwing", () => {
    const resolved = resolveMarketMenuProfileFromProviderLocale("xx-XX");
    expect(resolved.usedFallback).toBe(true);
    expect(resolved.market).toBe("NO");
    expect(resolved.menuProfileId).toBe("norwegian_company_lunch");
    expect(resolved.intlLocale).toBe("nb-NO");
    expect(resolveMenuProfileIdFromProviderLocale("")).toBe("norwegian_company_lunch");
  });

  it("UK market stores GB as default_country_code", () => {
    const uk = resolveMarketMenuProfileFromProviderLocale("en-GB");
    expect(uk.market).toBe("UK");
    expect(uk.defaultCountryCode).toBe("GB");
    expect(uk.menuProfileId).toBe("uk_office_lunch");
  });

  it("existing no-NO provider locale resolves unchanged", () => {
    const no = resolveMarketMenuProfileFromProviderLocale("nb-NO");
    expect(no.usedFallback).toBe(false);
    expect(no.menuProfileId).toBe("norwegian_company_lunch");
    expect(no.defaultCountryCode).toBe("NO");
  });
});
