/**
 * Unwraps `{ ok: true, data: T }` from API routes using jsonOk; passes through legacy top-level T.
 */
export function unwrapJsonOkData<T>(json: unknown): T | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (o.ok === true && "data" in o) return o.data as T;
  return json as T;
}
