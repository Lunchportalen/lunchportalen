// lib/supabase/server.ts
import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { getSupabasePublicConfig } from "@/lib/config/env";
import type { Database } from "@/lib/types/database";
import { hasSupabaseSsrAuthCookieInJar } from "@/lib/supabase/ssrSessionCookies";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

async function createSsrCookieClient() {
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

function hasSupabaseSsrAuthCookie(cookieStore: CookieStore): boolean {
  return hasSupabaseSsrAuthCookieInJar(cookieStore.getAll());
}

export type SupabaseSessionSource = "SSR_COOKIE" | "NONE";

/**
 * Cookie-jar signal only.
 * Brukes til auth-tracing/logging.
 * Bearer/API-flyt skal fortsatt gå via getAuthContext({ reqHeaders }).
 */
export function getSupabaseSessionSource(cookieStore: CookieStore): SupabaseSessionSource {
  return hasSupabaseSsrAuthCookie(cookieStore) ? "SSR_COOKIE" : "NONE";
}

/**
 * Cookie-bound SSR Supabase client.
 * Session refresh håndteres av middleware.
 * Ingen cookie-stored bearer fallback her.
 */
export async function supabaseServer() {
  return createSsrCookieClient();
}
