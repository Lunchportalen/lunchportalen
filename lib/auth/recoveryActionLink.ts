import { CANONICAL_PRODUCTION_APP_URL } from "@/lib/url/resolveAppBaseUrl";

export const CANONICAL_PASSWORD_RESET_REDIRECT = `${CANONICAL_PRODUCTION_APP_URL}/reset-password`;

/** Parse redirect_to from Supabase verify action_link without logging token. */
export function extractRedirectToFromActionLink(actionLink: string): string | null {
  try {
    const url = new URL(actionLink);
    const raw = url.searchParams.get("redirect_to");
    if (!raw) return null;
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

/** Safe diagnostic: hostname + path only, never token. */
export function describeRedirectTo(actionLink: string): { redirectTo: string | null; isLocalhost: boolean } {
  const redirectTo = extractRedirectToFromActionLink(actionLink);
  if (!redirectTo) return { redirectTo: null, isLocalhost: false };
  let isLocalhost = false;
  try {
    const host = new URL(redirectTo).hostname.toLowerCase();
    isLocalhost = host === "localhost" || host === "127.0.0.1";
  } catch {
    isLocalhost = redirectTo.includes("localhost") || redirectTo.includes("127.0.0.1");
  }
  return { redirectTo, isLocalhost };
}

/**
 * Supabase may embed Site URL as redirect_to when redirectTo is not allowlisted.
 * Rewrite verify-link redirect_to to the intended production target before emailing.
 * Token remains unchanged; only redirect_to query param is updated.
 */
export function normalizeRecoveryActionLink(actionLink: string, intendedRedirectTo: string): string {
  try {
    const url = new URL(actionLink);
    const current = extractRedirectToFromActionLink(actionLink);
    const intended = String(intendedRedirectTo ?? "").trim();
    if (!intended) return actionLink;

    const currentIsLocalhost =
      !current ||
      (() => {
        try {
          const h = new URL(current).hostname.toLowerCase();
          return h === "localhost" || h === "127.0.0.1";
        } catch {
          return current.includes("localhost") || current.includes("127.0.0.1");
        }
      })();

    const intendedIsProduction = intended.startsWith(CANONICAL_PRODUCTION_APP_URL);

    if (currentIsLocalhost && intendedIsProduction) {
      url.searchParams.set("redirect_to", intended);
      return url.toString();
    }

    if (current && current !== intended && intendedIsProduction && currentIsLocalhost) {
      url.searchParams.set("redirect_to", intended);
      return url.toString();
    }
  } catch {
    // fall through
  }
  return actionLink;
}
