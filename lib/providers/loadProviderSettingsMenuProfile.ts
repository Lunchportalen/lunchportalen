// lib/providers/loadProviderSettingsMenuProfile.ts
import "server-only";

import {
  resolveProviderMenuProfileFromSettings,
  type ProviderSettingsMenuProfileInput,
} from "@/lib/menu-profile/providerMenuProfileResolver";
import type { MenuProfileResolverResult } from "@/lib/menu-profile/types";
import {
  DEFAULT_PROVIDER_LOCALE,
} from "@/lib/providers/operationalSettingsShared";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DEFAULT_PROVIDER_CURRENCY = `${"NO"}K`;

export type ProviderSettingsMenuProfileRow = {
  providerId: string;
  menuProfileId: string | null;
  defaultCountryCode: string;
  locale: string;
  defaultCurrency: string;
};

/**
 * Read-only provider_settings row for menu profile resolution (ADR-019 G3).
 * Not exposed in provider UI or employee/customer APIs in this phase.
 */
export async function loadProviderSettingsMenuProfileRow(
  providerId: string,
): Promise<ProviderSettingsMenuProfileRow | null> {
  const pid = String(providerId ?? "").trim();
  if (!pid) return null;

  try {
    const admin = supabaseAdmin();
    const { data, error } = await (admin as any)
      .from("provider_settings")
      .select("menu_profile_id, default_country_code, locale, default_currency")
      .eq("provider_id", pid)
      .maybeSingle();

    if (error || !data) return null;

    return {
      providerId: pid,
      menuProfileId: data.menu_profile_id ?? null,
      defaultCountryCode: String(data.default_country_code ?? "").trim() || "NO",
      locale: String(data.locale ?? "").trim() || DEFAULT_PROVIDER_LOCALE,
      defaultCurrency: String(data.default_currency ?? "").trim() || DEFAULT_PROVIDER_CURRENCY,
    };
  } catch {
    return null;
  }
}

export function providerSettingsRowToMenuProfileInput(
  row: ProviderSettingsMenuProfileRow,
  env?: Readonly<Record<string, string | undefined>>,
): ProviderSettingsMenuProfileInput {
  return {
    providerId: row.providerId,
    menuProfileId: row.menuProfileId,
    defaultCountryCode: row.defaultCountryCode,
    locale: row.locale,
    env,
  };
}

/**
 * Load provider_settings and resolve menu profile behind LP_MENU_PROFILE_RESOLVER.
 * Flag OFF → legacy_disabled marker; no product behavior change until explicit cutover.
 */
export async function loadAndResolveProviderMenuProfile(
  providerId: string,
  env?: Readonly<Record<string, string | undefined>>,
): Promise<MenuProfileResolverResult | null> {
  const row = await loadProviderSettingsMenuProfileRow(providerId);
  if (!row) return null;
  return resolveProviderMenuProfileFromSettings(providerSettingsRowToMenuProfileInput(row, env));
}
