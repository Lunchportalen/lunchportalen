// lib/auth/postLoginNav.ts
// Canonical client-side navigation into the ONE post-login resolver
// (GET /api/auth/post-login). Every flow that establishes a session
// (login, password reset, invite acceptance, onboarding) must land here so
// role → home + agreement gate + next-allowlist is resolved server-side (E5).

/** Same allowlist semantics as sanitizePostLoginNextPath (client-side pre-filter). */
function safeNext(nextPath: string | null | undefined): string | null {
  const n = String(nextPath ?? "").trim();
  if (!n) return null;
  if (!n.startsWith("/")) return null;
  if (n.startsWith("//")) return null;
  if (n.startsWith("/api/")) return null;
  if (/[\n\r\t]/.test(n)) return null;
  if (
    n === "/login" ||
    n.startsWith("/login/") ||
    n === "/register" ||
    n.startsWith("/register/") ||
    n === "/registrering" ||
    n.startsWith("/registrering/") ||
    n === "/onboarding" ||
    n.startsWith("/onboarding/")
  ) {
    return null;
  }
  return n;
}

/** Build the canonical post-login URL. Server re-validates any `next`. */
export function buildPostLoginUrl(nextPath?: string | null): string {
  const next = safeNext(nextPath);
  return next ? `/api/auth/post-login?next=${encodeURIComponent(next)}` : "/api/auth/post-login";
}

/**
 * Hard-navigate into the post-login resolver. Full-page assign (not router.push)
 * so SSR auth cookies are read fresh and the server 303 decides the landing.
 */
export function goToPostLogin(nextPath?: string | null): void {
  if (typeof window === "undefined") return;
  window.location.assign(buildPostLoginUrl(nextPath));
}
