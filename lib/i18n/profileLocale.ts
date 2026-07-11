import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { parseAppLocale, type AppLocale } from "@/lib/i18n/middlewareLocale";

export type RequestLocalePreferences = {
  profile: AppLocale | null;
  /** Raw company default locale (validated by resolveAppLocale). */
  company: string | null;
  /** ISO country for market default (companies.billing_country). */
  marketCountry: string | null;
};

export async function loadProfilePreferredLocaleForRequest(): Promise<AppLocale | null> {
  const prefs = await loadLocalePreferencesForRequest();
  return prefs.profile;
}

/**
 * Fase E1: loads user profile locale + company default locale + market country
 * for the locale chain (user → company → market → nb). Fail-safe: any error
 * returns nulls so the chain falls through to the global default.
 */
export async function loadLocalePreferencesForRequest(): Promise<RequestLocalePreferences> {
  const empty: RequestLocalePreferences = { profile: null, company: null, marketCountry: null };
  try {
    const sb = await supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user?.id) return empty;

    const { data, error } = await sb
      .from("profiles")
      .select("preferred_locale, company_id")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) return empty;

    const row = data as { preferred_locale?: string | null; company_id?: string | null };
    const profile = parseAppLocale(row.preferred_locale);
    const companyId = String(row.company_id ?? "").trim();

    if (profile || !companyId) {
      // Profile wins anyway, or no company to consult.
      return { profile, company: null, marketCountry: null };
    }

    const { data: companyRow, error: cErr } = await sb
      .from("companies")
      .select("preferred_locale, billing_country")
      .eq("id", companyId)
      .maybeSingle();

    if (cErr || !companyRow) return { profile, company: null, marketCountry: null };

    const c = companyRow as { preferred_locale?: string | null; billing_country?: string | null };
    return {
      profile,
      company: c.preferred_locale ?? null,
      marketCountry: c.billing_country ?? null,
    };
  } catch {
    return empty;
  }
}
