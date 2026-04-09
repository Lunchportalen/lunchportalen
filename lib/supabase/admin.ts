// lib/supabase/admin.ts
import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

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
 * - SUPABASE_SERVICE_ROLE_KEY leses KUN her (CI / sikkerhetskrav). Aldri i browser, Server Components,
 *   middleware eller publishable-key-klienter — bruk `supabaseServer()` / `@/utils/supabase/server` for bruker-sesjon.
 * - Bruker server-var først (SUPABASE_URL), fallback til NEXT_PUBLIC_SUPABASE_URL for legacy.
 */

const TEST_SUPABASE_URL = "http://supabase.test";

function isTestEnv(): boolean {
  return process.env.NODE_ENV === "test" || !!process.env.VITEST;
}

function safeTrim(v: unknown): string {
  return String(v ?? "").trim();
}

function readAdminSupabaseUrl(): string {
  const explicitServerUrl = safeTrim(process.env.SUPABASE_URL);
  if (explicitServerUrl) return explicitServerUrl;
  const pub = safeTrim(process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (pub) return pub;
  if (isTestEnv()) return TEST_SUPABASE_URL;
  throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
}

function readServiceRoleKey(): string {
  const key = safeTrim(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (key) return key;
  throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
}

/** Single shared service-role client per Node process (do not create per request). */
let _admin: SupabaseClient<Database> | null = null;

function configError(message: string) {
  const e: any = new Error(message);
  e.code = "CONFIG_ERROR";
  e.status = 500;
  return e;
}

export function supabaseAdmin(): SupabaseClient<Database> {
  if (_admin) return _admin;

  let url: string;
  let serviceRoleKey: string;

  try {
    url = readAdminSupabaseUrl();
    serviceRoleKey = readServiceRoleKey();
  } catch (e: any) {
    // Normaliser til CONFIG_ERROR for kompatibilitet med eksisterende kallere.
    throw configError(e?.message ?? "Mangler Supabase admin-konfigurasjon i server-miljø.");
  }

  _admin = createClient<Database>(url, serviceRoleKey, {
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
    const url = readAdminSupabaseUrl();
    const key = safeTrim(process.env.SUPABASE_SERVICE_ROLE_KEY);
    return Boolean(url && key);
  } catch {
    return false;
  }
}

