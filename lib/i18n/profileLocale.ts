import "server-only";

import { supabaseServer } from "@/lib/supabase/server";
import { parseAppLocale, type AppLocale } from "@/lib/i18n/middlewareLocale";

export async function loadProfilePreferredLocaleForRequest(): Promise<AppLocale | null> {
  try {
    const sb = await supabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user?.id) return null;

    const { data, error } = await sb
      .from("profiles")
      .select("preferred_locale")
      .eq("id", user.id)
      .maybeSingle();

    if (error) return null;
    return parseAppLocale((data as { preferred_locale?: string | null } | null)?.preferred_locale);
  } catch {
    return null;
  }
}
