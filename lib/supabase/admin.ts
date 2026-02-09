// lib/supabase/admin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase ADMIN client (SERVICE ROLE)
 * ====================================
 * Brukes KUN server-side til:
 * - superadmin-endepunkter
 * - eksplisitt omgåelse av RLS
 *
 * ⚠️ ALDRI bruk i client components
 * ⚠️ ALDRI eksponer service role til browser
 *
 * Design:
 * - Singleton per runtime
 * - Fail-fast hvis env mangler
 * - Ingen session / cookies
 * - Stabil client-info for logging
 */

let _admin: SupabaseClient | null = null;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) {
    throw new Error(`Missing required env: ${name}`);
  }
  return String(v).trim();
}

export function supabaseAdmin(): SupabaseClient {
  // Reuse client within same runtime
  if (_admin) return _admin;

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  _admin = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "lunchportalen-admin",
      },
    },
  });

  return _admin;
}
