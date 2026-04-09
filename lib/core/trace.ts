/**
 * Lettvekts sporbarhet (server/client).
 */
export function trace(label: string, data?: unknown): void {
  const payload =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>)
      : data !== undefined
        ? { value: data }
        : {};
  console.log(`[TRACE:${label}]`, { ts: Date.now(), ...payload });
}
