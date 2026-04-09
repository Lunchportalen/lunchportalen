/** Best-effort lesing av { message } / { error } fra JSON-feilsvar (kun klient). */
export function apiErrorMessageFromJson(j: unknown, fallback: string): string {
  if (j && typeof j === "object") {
    const o = j as { message?: unknown; error?: unknown };
    const m = typeof o.message === "string" ? o.message.trim() : "";
    if (m) return m;
    const e = typeof o.error === "string" ? o.error.trim() : "";
    if (e) return e;
  }
  return fallback;
}
