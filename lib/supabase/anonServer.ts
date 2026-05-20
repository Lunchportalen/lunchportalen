import "server-only";

import { createClient } from "@supabase/supabase-js";

import { getSupabasePublicConfig } from "@/lib/config/env-public";
import type { Database } from "@/lib/types/database";

/** Cookie-less anon client for public RPC (e.g. /registrer intake). */
export function supabaseAnonServer() {
  const { url, anonKey } = getSupabasePublicConfig();
  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
