// lib/supabase/client.ts
// Browser-side Supabase client — brukes KUN i "use client"-komponenter.

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";
import { getSupabasePublicCredentials } from "@/lib/supabase/publicEnv";

let browserClient: SupabaseClient<Database> | null = null;

export function createClient(): SupabaseClient<Database> {
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabasePublicCredentials();

  browserClient = createBrowserClient<Database>(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

export function supabaseBrowser(): SupabaseClient<Database> {
  return createClient();
}
