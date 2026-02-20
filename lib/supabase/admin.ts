// lib/supabase/admin.ts
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase ADMIN client (SERVICE ROLE)
 * ====================================
 * Brukes KUN server-side til:
 * - admin/superadmin-endepunkter
 * - eksplisitt omgåelse av RLS
 *
 * Krav:
 * - Fail-closed hvis env mangler
 * - Ingen cookies / session
 * - Stabil X-Client-Info for logging
 *
 * NOTE:
 * - Bruker server-var først (SUPABASE_URL), fallback til NEXT_PUBLIC_SUPABASE_URL for legacy.
 * - Bruker kun SUPABASE_SERVICE_ROLE_KEY (service role).
 */

let _admin: SupabaseClient | null = null;

function envStr(name: string): string | null {
  const v = process.env[name];
  const s = String(v ?? "").trim();
  return s ? s : null;
}

function configError(message: string) {
  const e: any = new Error(message);
  e.code = "CONFIG_ERROR";
  e.status = 500;
  return e;
}

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  const url = envStr("SUPABASE_URL") ?? envStr("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = envStr("SUPABASE_SERVICE_ROLE_KEY");

  if (!url) throw configError("Mangler SUPABASE_URL (eller NEXT_PUBLIC_SUPABASE_URL) i server-miljø.");
  if (!serviceRoleKey) throw configError("Mangler SUPABASE_SERVICE_ROLE_KEY i server-miljø.");

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

export function hasSupabaseAdminConfig(): boolean {
  const url = envStr("SUPABASE_URL") ?? envStr("NEXT_PUBLIC_SUPABASE_URL");
  const key = envStr("SUPABASE_SERVICE_ROLE_KEY");
  return Boolean(url && key);
}
