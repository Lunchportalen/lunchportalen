// STATUS: KEEP

import "server-only";

export function noStoreHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "cache-control": "no-store, max-age=0",
    pragma: "no-cache",
    expires: "0",
    ...extra,
  };
}
