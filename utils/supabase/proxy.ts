/**
 * Refreshes the Supabase session from request cookies and returns `NextResponse.next`.
 * Call from root `middleware.ts` (Next.js 15). For Next.js 16+, the same logic lives in root `proxy.ts` (see Next.js “Proxy” docs).
 *
 * Layer: refresh + cookie sync only — no `getSession()`, no service role, no profile lookup.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/lib/types/database";
import { getSupabasePublicCredentials } from "@/utils/supabase/publicEnv";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

export type UpdateSessionResult = {
  response: NextResponse;
  /** True if SSR auth-token jar is present on the refreshed request and/or outgoing response. */
  hasSupabaseSessionCookie: boolean;
};

export async function updateSession(
  request: NextRequest,
  forwardRequestHeaders: Headers
): Promise<UpdateSessionResult> {
  const { url, anonKey } = getSupabasePublicCredentials();

  let response = NextResponse.next({
    request: { headers: forwardRequestHeaders },
  });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({
          request: { headers: forwardRequestHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  await supabase.auth.getClaims();

  const hasSupabaseSessionCookie =
    hasSupabaseSsrAuthCookieInJar(request.cookies.getAll()) ||
    hasSupabaseSsrAuthCookieInJar(response.cookies.getAll());

  return { response, hasSupabaseSessionCookie };
}
