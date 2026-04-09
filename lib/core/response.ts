/**
 * Small deterministic payload shapes (internal helpers).
 * HTTP routes must still use `jsonOk` / `jsonErr` (`{ ok, rid, data }` / errors) — ikke returner disse direkte som HTTP-body uten mapping.
 */
export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function fail(code: string, message: string): { ok: false; code: string; message: string } {
  return { ok: false, code, message };
}
