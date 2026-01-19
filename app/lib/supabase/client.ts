// lib/supabase/client.ts
// Browser-side Supabase client
// Brukes kun i "use client"-komponenter

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// Enkel singleton for å unngå å opprette flere klienter i samme session
let browserClient: SupabaseClient | null = null;

export function supabaseBrowser(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase environment variables mangler. Sjekk NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  browserClient = createBrowserClient(url, anonKey);

  return browserClient;
}
