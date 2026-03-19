// lib/supabase/admin.ts
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminConfig } from "@/lib/config/env";

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

function configError(message: string) {
  const e: any = new Error(message);
  e.code = "CONFIG_ERROR";
  e.status = 500;
  return e;
}

export function supabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;

  let url: string;
  let serviceRoleKey: string;

  try {
    const cfg = getSupabaseAdminConfig();
    url = cfg.url;
    serviceRoleKey = cfg.serviceRoleKey;
  } catch (e: any) {
    // Normaliser til CONFIG_ERROR for kompatibilitet med eksisterende kallere.
    throw configError(e?.message ?? "Mangler Supabase admin-konfigurasjon i server-miljø.");
  }

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
  try {
    const cfg = getSupabaseAdminConfig();
    return Boolean(cfg.url && cfg.serviceRoleKey);
  } catch {
    return false;
  }
}

