/**
 * Edge-safe session gate for /api/edge/* routes (cookie jar presence only).
 * Does not validate JWT — middleware + Node routes use full scopeOr401.
 */
import { jsonErr, makeRid } from "@/lib/http/edgeContract";
import { hasSupabaseSsrAuthCookieInJar } from "@/utils/supabase/ssrSessionCookies";

function cookiesFromRequest(req: Request): { name: string; value: string }[] {
  const raw = req.headers.get("cookie") ?? "";
  if (!raw) return [];
  return raw
    .split(";")
    .map((part) => {
      const eq = part.indexOf("=");
      if (eq < 0) return { name: part.trim(), value: "" };
      return { name: part.slice(0, eq).trim(), value: part.slice(eq + 1).trim() };
    })
    .filter((c) => c.name.length > 0);
}

/** Returns 401 Response or null when Supabase SSR auth cookie jar is present. */
export function denyUnlessEdgeSession(req: Request): Response | null {
  if (!hasSupabaseSsrAuthCookieInJar(cookiesFromRequest(req))) {
    return jsonErr(makeRid("edge_auth"), "Ikke innlogget.", 401, "UNAUTHORIZED");
  }
  return null;
}
