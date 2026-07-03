// lib/providers/loadProviderOperationalSettings.ts
import "server-only";

import {
  DEFAULT_PROVIDER_LOCALE,
  isSupportedProviderLocale,
  type ProviderOperationalSettings,
} from "@/lib/providers/operationalSettingsShared";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Leser provider-eide driftsinnstillinger for visning i /leverandor/innstillinger.
 * Lesing skjer server-side med service-role-klienten (provider_settings sin
 * select-RLS er org-claims-basert og dekker ikke provider-sesjoner).
 * Kalleren er ansvarlig for provider_admin-gating (gjøres på siden).
 */
export async function loadProviderOperationalSettings(
  providerId: string,
): Promise<ProviderOperationalSettings> {
  const empty: ProviderOperationalSettings = {
    operationsEmail: null,
    kitchenEmail: null,
    deliveryEmail: null,
    locale: DEFAULT_PROVIDER_LOCALE,
    menuProfileId: null,
    defaultCountryCode: "NO",
  };

  const pid = String(providerId ?? "").trim();
  if (!pid) return empty;

  try {
    const admin = supabaseAdmin();
    const { data, error } = await (admin as any)
      .from("provider_settings")
      .select("operations_email, kitchen_email, delivery_email, locale, menu_profile_id, default_country_code")
      .eq("provider_id", pid)
      .maybeSingle();

    if (error || !data) return empty;

    const locale = String(data.locale ?? "").trim();
    const country = String(data.default_country_code ?? "NO").trim().toUpperCase();
    return {
      operationsEmail: data.operations_email ?? null,
      kitchenEmail: data.kitchen_email ?? null,
      deliveryEmail: data.delivery_email ?? null,
      locale: isSupportedProviderLocale(locale) ? locale : DEFAULT_PROVIDER_LOCALE,
      menuProfileId: data.menu_profile_id ?? null,
      defaultCountryCode: country.length === 2 ? country : "NO",
    };
  } catch {
    return empty;
  }
}
