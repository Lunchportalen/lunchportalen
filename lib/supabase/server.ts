// lib/supabase/server.ts
import "server-only";

import { cookies } from "next/headers";
import { createClient as createSsrCookieClient } from "@/utils/supabase/server";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

function hasSupabaseSsrAuthCookie(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  return hasSupabaseSsrAuthCookieInJar(cookieStore.getAll());
}

export type SupabaseSessionSource = "SSR_COOKIE" | "NONE";

/** Cookie-jar signal only — use for auth tracing. Bearer/API flows use `getAuthContext({ reqHeaders })`. */
export function getSupabaseSessionSource(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): SupabaseSessionSource {
  if (hasSupabaseSsrAuthCookie(cookieStore)) return "SSR_COOKIE";
  return "NONE";
}

/**
 * Cookie-bound SSR Supabase client (refresh via middleware). No cookie-stored bearer fallback here.
 */
export async function supabaseServer() {
  return createSsrCookieClient();
}

