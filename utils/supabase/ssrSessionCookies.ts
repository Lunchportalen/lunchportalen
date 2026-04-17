/**
 * Edge-safe detection of Supabase SSR auth cookies (`sb-*-auth-token*`, including chunked variants).
 * Canonical “has a Supabase browser session jar” signal for middleware after `updateSession`.
 * Does not validate JWTs — only presence of the cookie names Supabase SSR uses.
 */
export function hasSupabaseSsrAuthCookieInJar(
  entries: Iterable<{ name: string; value?: string }>
): boolean {
  for (const c of entries) {
    const n = String(c.name ?? "");
    if (n.startsWith("sb-") && n.includes("auth-token")) return true;
  }
  return false;
}
