// lib/http/noStore.ts
import "server-only";

/**
 * Standard no-store headers for ALL API responses
 * ------------------------------------------------
 * Fasit: hindrer caching i:
 * - nettleser
 * - mellomliggende proxy
 * - CDN/edge (Vercel/Cloudflare)
 *
 * Brukes av jsonOk/jsonErr via respond.ts
 */
export function noStoreHeaders() {
  return {
    // HTTP/1.1
    "cache-control": "no-store, max-age=0",

    // HTTP/1.0 (eldre proxyer)
    pragma: "no-cache",

    // Proxies / klienter som respekterer Expires
    expires: "0",

    // CDNs / surrogate caches
    "surrogate-control": "no-store",

    // Bonus: hindrer at noen mellomledd prøver å "optimalisere"/transformere
    "x-content-type-options": "nosniff",
  } as const;
}
