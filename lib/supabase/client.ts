// lib/supabase/client.ts
// Browser-side Supabase client
// Brukes KUN i "use client"-komponenter

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/config/env-public";

// Singleton for browser-session
let browserClient: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabasePublicConfig();

  browserClient = createBrowserClient(url, anonKey, {
    auth: {
      // Viktig for stabil client-state + logout
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

