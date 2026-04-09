import "server-only";

let active = 0;
const LIMIT = 100;

export function concurrencyActive(): number {
  return active;
}

export function concurrencyLimit(): number {
  return LIMIT;
}

/**
 * Begrenser samtidige kritiske operasjoner per prosess (pod-sikkerhet).
 */
export async function guardConcurrency<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= LIMIT) {
    console.error("[POD_OVERLOAD]", { active, limit: LIMIT });
    throw {
      code: "POD_OVERLOAD",
      message: "Too many concurrent operations",
      source: "infra",
      severity: "medium",
    };
  }

  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
  }
}
