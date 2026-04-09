import "server-only";

import { retry } from "@/lib/recovery/retry";

/**
 * Retry deretter deterministisk fallback (aldri throw til kaller).
 */
export async function recover<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await retry(fn);
  } catch (e) {
    console.error("[RECOVERY_FALLBACK]", e);
    return fallback;
  }
}
