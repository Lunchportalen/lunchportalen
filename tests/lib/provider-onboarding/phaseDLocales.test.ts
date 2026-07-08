import { describe, expect, it } from "vitest";

import { getMarketDefaults } from "@/lib/menu-profile/marketDefaults";
import { isSupportedMenuProfile } from "@/lib/menu-profile/registry";
import { getTierDisplayLabel } from "@/lib/tiers/displayLabels";
import {
  PHASE_D_PROVIDER_REQUIRED_TIMEZONE_MARKETS,
  PHASE_D_RICH_MARKET_TARGETS,
  phaseDTargetForLocale,
  phaseDTargetsByRolloutOrder,
} from "@/lib/provider-onboarding/phaseDLocales";

const EXPECTED = [
  ["en-US", "us_office_lunch", "US", "USD", "provider_required", "America/New_York"],
  ["en-CA", "canadian_office_lunch", "CA", "CAD", "provider_required", "America/Toronto"],
  ["nl-NL", "dutch_office_lunch", "NL", "EUR", "fixed", "Europe/Amsterdam"],
  ["nl-BE", "belgian_dutch_office_lunch", "BE", "EUR", "fixed", "Europe/Brussels"],
  ["fr-BE", "belgian_french_office_lunch", "BE", "EUR", "fixed", "Europe/Brussels"],
  ["de-AT", "austrian_office_lunch", "AT", "EUR", "fixed", "Europe/Vienna"],
  ["de-CH", "swiss_german_office_lunch", "CH", "CHF", "fixed", "Europe/Zurich"],
  ["fr-CH", "swiss_french_office_lunch", "CH", "CHF", "fixed", "Europe/Zurich"],
  ["en-IE", "irish_office_lunch", "IE", "EUR", "fixed", "Europe/Dublin"],
  ["fr-LU", "luxembourg_office_lunch", "LU", "EUR", "fixed", "Europe/Luxembourg"],
  ["en-AU", "australian_office_lunch", "AU", "AUD", "provider_required", "Australia/Sydney"],
  ["en-SG", "singapore_office_lunch", "SG", "SGD", "fixed", "Asia/Singapore"],
] as const;

describe("Phase D rich-market rollout control", () => {
  it("defines all 12 source-only targets in deterministic rollout order", () => {
    expect(PHASE_D_RICH_MARKET_TARGETS).toHaveLength(12);
    expect(phaseDTargetsByRolloutOrder().map((target) => target.rolloutOrder)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1),
    );

    for (const [locale, menuProfileId, countryCode, currency, timezoneStrategy, timezone] of EXPECTED) {
      const target = phaseDTargetForLocale(locale);
      expect(target).toMatchObject({
        locale,
        menuProfileId,
        countryCode,
        currency,
        timezoneStrategy,
        status: "SOURCE_ONLY",
        applyEnabled: false,
        publishEnabled: false,
        customerVisible: false,
        rolloutAutomationEnabled: false,
      });
      if (timezoneStrategy === "provider_required") {
        expect(target?.defaultTimezoneForPilot).toBe(timezone);
        expect(target?.timezone).toBeUndefined();
      } else {
        expect(target?.timezone).toBe(timezone);
      }
    }
  });

  it("has no duplicate slug or locale/profile pair", () => {
    const slugs = PHASE_D_RICH_MARKET_TARGETS.map((target) => target.slug);
    const localeProfilePairs = PHASE_D_RICH_MARKET_TARGETS.map(
      (target) => `${target.locale}/${target.menuProfileId}`,
    );

    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(localeProfilePairs).size).toBe(localeProfilePairs.length);
  });

  it("has market defaults and registered source-only menu profile stubs for every target", () => {
    for (const target of PHASE_D_RICH_MARKET_TARGETS) {
      const defaults = getMarketDefaults(target.countryCode);
      expect(isSupportedMenuProfile(target.menuProfileId)).toBe(true);
      expect(defaults.defaultCurrency).toBe(target.currency);

      if (target.timezoneStrategy === "provider_required") {
        expect(defaults.timezoneStrategy).toBe("provider_required");
        expect(defaults.defaultTimezoneForPilot).toBe(target.defaultTimezoneForPilot);
      } else {
        expect(defaults.timezoneStrategy).toBe("fixed");
        expect(defaults.defaultTimezone).toBe(target.timezone);
      }
    }
  });

  it("flags only US, CA and AU as provider-required timezone markets", () => {
    expect(PHASE_D_PROVIDER_REQUIRED_TIMEZONE_MARKETS).toEqual(["US", "CA", "AU"]);
    const providerRequired = PHASE_D_RICH_MARKET_TARGETS
      .filter((target) => target.timezoneStrategy === "provider_required")
      .map((target) => target.countryCode);
    expect(providerRequired).toEqual(["US", "CA", "AU"]);
  });

  it("has locale-aware tier display labels for every Phase D locale", () => {
    for (const target of PHASE_D_RICH_MARKET_TARGETS) {
      expect(getTierDisplayLabel("ENTERPRISE", target.locale)).toBe("Enterprise");
      expect(getTierDisplayLabel("LUXUS", target.locale)).toBe("Premium");
      expect(getTierDisplayLabel("BASIS", target.locale)).not.toBe("BASIS");
    }
  });
});
