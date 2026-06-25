// lib/providers/providerMenuProfileDiagnostic.ts
import "server-only";

import { getDefaultMenuProfileForMarket } from "@/lib/menu-profile/marketDefaults";
import {
  isMenuProfileResolverEnabled,
  LP_MENU_PROFILE_FIXED_CATEGORIES_ENV,
  LP_MENU_PROFILE_RESOLVER_ENV,
} from "@/lib/menu-profile/featureFlag";
import { getMenuProfile } from "@/lib/menu-profile/registry";
import { providerCountryCodeToMarket } from "@/lib/menu-profile/providerMenuProfileResolver";
import { resolveProviderMenuProfileFromSettings } from "@/lib/menu-profile/providerMenuProfileResolver";
import type {
  MenuProfileId,
  MenuProfileResolverResult,
  MenuProfileResolveSource,
} from "@/lib/menu-profile/types";
import {
  loadProviderSettingsMenuProfileRow,
  providerSettingsRowToMenuProfileInput,
  type ProviderSettingsMenuProfileRow,
} from "@/lib/providers/loadProviderSettingsMenuProfile";

export type ProviderMenuProfileDiagnosticResolved = {
  kind: "resolved";
  enabled: true;
  source: MenuProfileResolveSource;
  profileId: string;
  profileName: string;
  market: string;
  locale: string;
  currencyDefault: string;
  warning?: string;
};

export type ProviderMenuProfileDiagnosticError = {
  kind: "error";
  enabled: true;
  reason: "unsupported_menu_profile";
  message: string;
};

export type ProviderMenuProfileDiagnosticLegacy = {
  kind: "legacy";
  enabled: false;
  resolverActive: boolean;
  marketCode: string;
  market: string;
  profileId: string;
  profileName: string;
  currency: string;
  operationalLocale: string;
};

export type ProviderMenuProfileDiagnostic =
  | ProviderMenuProfileDiagnosticResolved
  | ProviderMenuProfileDiagnosticError
  | ProviderMenuProfileDiagnosticLegacy;

/** Host env bag for menu profile feature flags (server wiring only). */
export function menuProfileResolverHostEnv(): Readonly<Record<string, string | undefined>> {
  return {
    [LP_MENU_PROFILE_RESOLVER_ENV]: process.env.LP_MENU_PROFILE_RESOLVER,
    [LP_MENU_PROFILE_FIXED_CATEGORIES_ENV]: process.env.LP_MENU_PROFILE_FIXED_CATEGORIES,
  };
}

function inferLegacyProfile(row: ProviderSettingsMenuProfileRow) {
  if (row.menuProfileId) {
    try {
      const fromSetting = getMenuProfile(row.menuProfileId as MenuProfileId);
      if (fromSetting) return fromSetting;
    } catch {
      // fall through to market default
    }
  }
  const market = providerCountryCodeToMarket(row.defaultCountryCode) ?? "NO";
  return getDefaultMenuProfileForMarket(market);
}

export function buildProviderMenuProfileLegacyDiagnostic(
  row: ProviderSettingsMenuProfileRow,
  resolverActive: boolean,
): ProviderMenuProfileDiagnosticLegacy {
  const profile = inferLegacyProfile(row);
  const market = providerCountryCodeToMarket(row.defaultCountryCode) ?? profile.market;

  return {
    kind: "legacy",
    enabled: false,
    resolverActive,
    marketCode: row.defaultCountryCode,
    market,
    profileId: profile.id,
    profileName: profile.name,
    currency: row.defaultCurrency,
    operationalLocale: row.locale,
  };
}

export function buildProviderMenuProfileDiagnostic(
  row: ProviderSettingsMenuProfileRow | null,
  resolverResult: MenuProfileResolverResult | null,
): ProviderMenuProfileDiagnostic | null {
  if (!resolverResult || !row) return null;

  if (resolverResult.ok === false) {
    return {
      kind: "error",
      enabled: true,
      reason: resolverResult.reason,
      message: resolverResult.message,
    };
  }

  if (!resolverResult.enabled) return null;

  return {
    kind: "resolved",
    enabled: true,
    source: resolverResult.source,
    profileId: resolverResult.profile.id,
    profileName: resolverResult.profile.name,
    market: resolverResult.profile.market,
    locale: resolverResult.profile.locale,
    currencyDefault: row.defaultCurrency ?? resolverResult.profile.market,
    warning: resolverResult.warning,
  };
}

/**
 * Read-only market/menu profile/currency diagnostic for provider admin (ADR-019 G4 + pre-G5a).
 * Flag OFF → legacy context (why UI locale ≠ menu/currency). Flag ON → resolver diagnostics when active.
 */
export async function loadProviderMenuProfileDiagnostic(
  providerId: string,
  env: Readonly<Record<string, string | undefined>> = menuProfileResolverHostEnv(),
): Promise<ProviderMenuProfileDiagnostic | null> {
  const row = await loadProviderSettingsMenuProfileRow(providerId);
  if (!row) return null;

  const resolverActive = isMenuProfileResolverEnabled(env);

  if (resolverActive) {
    const resolverResult = resolveProviderMenuProfileFromSettings(
      providerSettingsRowToMenuProfileInput(row, env),
    );
    const active = buildProviderMenuProfileDiagnostic(row, resolverResult);
    if (active) return active;
  }

  return buildProviderMenuProfileLegacyDiagnostic(row, resolverActive);
}
