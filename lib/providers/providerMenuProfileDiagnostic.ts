// lib/providers/providerMenuProfileDiagnostic.ts
import "server-only";

import {
  isMenuProfileResolverEnabled,
  LP_MENU_PROFILE_RESOLVER_ENV,
} from "@/lib/menu-profile/featureFlag";
import { resolveProviderMenuProfileFromSettings } from "@/lib/menu-profile/providerMenuProfileResolver";
import type { MenuProfileResolverResult, MenuProfileResolveSource } from "@/lib/menu-profile/types";
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

export type ProviderMenuProfileDiagnostic =
  | ProviderMenuProfileDiagnosticResolved
  | ProviderMenuProfileDiagnosticError;

/** Host env bag for LP_MENU_PROFILE_RESOLVER (server wiring only). */
export function menuProfileResolverHostEnv(): Readonly<Record<string, string | undefined>> {
  return { [LP_MENU_PROFILE_RESOLVER_ENV]: process.env.LP_MENU_PROFILE_RESOLVER };
}

export function buildProviderMenuProfileDiagnostic(
  row: ProviderSettingsMenuProfileRow | null,
  resolverResult: MenuProfileResolverResult | null,
): ProviderMenuProfileDiagnostic | null {
  if (!resolverResult) return null;

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
    currencyDefault: row?.defaultCurrency ?? resolverResult.profile.market,
    warning: resolverResult.warning,
  };
}

/**
 * Read-only menu profile diagnostic for provider admin surfaces (ADR-019 G4).
 * Returns null when flag OFF or settings row missing — no product behavior change.
 */
export async function loadProviderMenuProfileDiagnostic(
  providerId: string,
  env: Readonly<Record<string, string | undefined>> = menuProfileResolverHostEnv(),
): Promise<ProviderMenuProfileDiagnostic | null> {
  if (!isMenuProfileResolverEnabled(env)) return null;

  const row = await loadProviderSettingsMenuProfileRow(providerId);
  if (!row) return null;

  const resolverResult = resolveProviderMenuProfileFromSettings(
    providerSettingsRowToMenuProfileInput(row, env),
  );

  return buildProviderMenuProfileDiagnostic(row, resolverResult);
}
