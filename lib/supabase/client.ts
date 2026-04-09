// lib/supabase/client.ts
// Browser-side Supabase client — brukes KUN i "use client"-komponenter.
// Canonical implementation: `@/utils/supabase/client`.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { createClient as createBrowserSupabaseClient } from "@/utils/supabase/client";

export function createClient(): SupabaseClient<Database> {
  return createBrowserSupabaseClient();
}

export function supabaseBrowser(): SupabaseClient<Database> {
  return createBrowserSupabaseClient();
}

