/**
 * Standalone Supabase service-role client for scripts (does not import app `server-only` modules).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

import type { Database } from "../../../lib/types/database";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ path: ".env", quiet: true });

export type SystemTestAdmin = SupabaseClient<Database>;

let _client: SystemTestAdmin | null = null;

export function getSupabaseAdmin(): SystemTestAdmin {
  if (_client) return _client;

  const url = String(process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY");
  }

  _client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return _client;
}
