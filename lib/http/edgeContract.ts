/**
 * Edge-runtime JSON-kontrakt (ingen "server-only" / Node-only deps).
 * Matcher fasit { ok, rid, data } / { ok:false, rid, message, status, error }.
 */

function normalizeError(err: unknown): string {
  if (err === undefined || err === null) return "ERROR";
  if (typeof err === "string") return err || "ERROR";
  if (err instanceof Error) return err.name || err.message || "ERROR";
  if (typeof err === "object" && err !== null && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return "ERROR";
}

export function makeRid(prefix = "edge"): string {
  const t = Date.now().toString(36);
  const r =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${t}_rnd`;
  return `${prefix}_${t}_${r}`;
}

export function jsonOk<T>(
  rid: string,
  data: T,
  status = 200,
  extraHeaders?: Record<string, string>,
): Response {
  const h = new Headers({
    "content-type": "application/json; charset=utf-8",
    "x-rid": rid,
    "cache-control": extraHeaders?.["Cache-Control"] ?? "no-store",
  });
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (k === "Cache-Control") continue;
      if (v) h.set(k, v);
    }
  }
  return new Response(
    JSON.stringify({
      ok: true as const,
      rid,
      data: data ?? null,
    }),
    { status, headers: h },
  );
}

export function jsonErr(
  rid: string,
  message: string,
  status = 400,
  error?: unknown,
  detail?: unknown,
): Response {
  const errorOut = normalizeError(error);
  const payload: Record<string, unknown> = {
    ok: false as const,
    rid,
    message,
    status,
    error: errorOut,
  };
  if (detail !== undefined) payload.detail = detail;
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-rid": rid,
    },
  });
}
