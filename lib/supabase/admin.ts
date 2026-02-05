// lib/supabase/admin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase admin-klient (SERVICE ROLE)
 * --------------------------------------------------
 * Brukes KUN server-side til:
 * - superadmin-handlinger (activate / reject / purge)
 * - eksplisitt omgåelse av RLS
 *
 * ⚠️ Skal ALDRI brukes i client components
 * ⚠️ Skal ALDRI eksponeres til browser
 *
 * Designvalg:
 * - Kaster eksplisitt feil hvis env mangler (fail fast)
 * - Ingen session / cookies
 * - Stabil X-Client-Info for logging/debug
 */

let _admin: SupabaseClient | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing env: ${name}`);
  }
  return String(v).trim();
}

export function supabaseAdmin(): SupabaseClient {
  // Singleton per runtime (unngår unødige klienter)
  if (_admin) return _admin;

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  _admin = createClient(url, serviceKey, {
    auth: {
      persistSession: false,      // ingen cookies
      autoRefreshToken: false,    // ingen refresh
      detectSessionInUrl: false,  // ingen URL-lekkasje
    },
    global: {
      headers: {
        "X-Client-Info": "lunchportalen-admin",
      },
    },
  });

  return _admin;
}
