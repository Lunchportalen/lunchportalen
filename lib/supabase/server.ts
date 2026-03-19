// lib/supabase/server.ts
import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/config/env";

/**
 * ✅ Enterprise: SSR auth via httpOnly cookies (single truth)
 * - Reads cookies from Next headers()
 * - Writes cookies back via setAll()
 * - Fails fast with clear error if Supabase env is missing.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicConfig();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // NOTE: This can throw in some edge contexts; ignore safely.
        try {
          for (const c of cookiesToSet) {
            cookieStore.set(c.name, c.value, c.options);
          }
        } catch {
          // ignore
        }
      },
    },
  });
}

