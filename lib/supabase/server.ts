// lib/supabase/server.ts
import "server-only";

import { cookies } from "next/headers";
import { createClient as createSsrCookieClient } from "@/utils/supabase/server";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

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