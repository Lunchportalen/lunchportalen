// STATUS: KEEP

import "server-only";

/**
 * Enterprise: bruk Upstash/Redis senere.
 * Nå: “no-op” som ikke ødelegger flyt.
 */
export async function rateLimitOrThrow(_key: string, _limit: number, _windowSec: number) {
  return;
}
