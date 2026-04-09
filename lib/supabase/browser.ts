// lib/supabase/browser.ts — legacy shim; prefer `@/lib/supabase/client` or `@/utils/supabase/client`.
"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { createClient } from "@/utils/supabase/client";

export function supabaseBrowser(): SupabaseClient<Database> {
  return createClient();
}
