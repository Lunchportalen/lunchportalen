import { throwError } from "@/lib/core/errors";

/**
 * Fail-closed fetch with AbortSignal (default 5s). Non-OK HTTP throws {@link AppError}.
 */
export async function fetchSafe(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const timeoutMs = typeof init?.timeoutMs === "number" && init.timeoutMs > 0 ? init.timeoutMs : 5000;
  const { timeoutMs: _t, ...rest } = init ?? {};
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...rest, signal: controller.signal });
    return await finalizeFetchResponse(url, res);
  } finally {
    clearTimeout(t);
  }
}

async function finalizeFetchResponse(url: string, res: Response): Promise<Response> {
  if (!res.ok) {
    throwError({
      code: "FETCH_FAILED",
      message: `${url} failed with status ${res.status}`,
      source: "fetchSafe",
      severity: "high",
    });
  }
  return res;
}

/**
 * Same as {@link fetchSafe} but parses JSON body. Throws on empty body or invalid JSON.
 */
export async function fetchSafeJson<T = unknown>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<T> {
  const res = await fetchSafe(url, init);
  const text = await res.text();
  if (!text.trim()) {
    throwError({
      code: "FETCH_EMPTY_BODY",
      message: `${url} returned empty body`,
      source: "fetchSafe",
      severity: "high",
    });
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throwError({
      code: "FETCH_INVALID_JSON",
      message: `${url} returned non-JSON body`,
      source: "fetchSafe",
      severity: "high",
    });
  }
}
