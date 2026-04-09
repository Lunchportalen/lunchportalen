import "server-only";

let active = 0;

const LOAD_LIMIT = {
  code: "LOAD_LIMIT",
  message: "Too many requests",
  source: "infra",
  severity: "high" as const,
};

/**
 * Enkel in-process konkurrentgrense (én Node-instans). Fail-closed ved overload.
 */
export async function withLoadGuard<T>(fn: () => Promise<T>, limit = 50): Promise<T> {
  const lim = typeof limit === "number" && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
  if (active >= lim) {
    throw LOAD_LIMIT;
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
  }
}
