// Server Components, Server Actions, Route Handlers — cookie-bound SSR client.
import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/config/env";
import type { Database } from "@/lib/types/database";

export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          /* Server Components cannot always set cookies — middleware refresh handles it */
        }
      },
    },
  });
}
