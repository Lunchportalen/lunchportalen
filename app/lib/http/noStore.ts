// lib/http/noStore.ts
import "server-only";

/**
 * Standard no-store headers for ALL API responses
 * ------------------------------------------------
 * Brukes konsekvent for å hindre:
 * - edge / CDN caching
 * - browser back/forward cache
 * - mellomliggende proxy-cache
 *
 * Dette er fasit for Lunchportalen (Dag 10).
 */
export function noStoreHeaders() {
  return {
    // HTTP/1.1
    "Cache-Control": "no-store, max-age=0",

    // HTTP/1.0 (eldre proxyer)
    Pragma: "no-cache",

    // Proxies / klienter som respekterer Expires
    Expires: "0",

    // Ekstra forsikring mot transformering/caching i mellomledd
    "Surrogate-Control": "no-store",
  } as const;
}
