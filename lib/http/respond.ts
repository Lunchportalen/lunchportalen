// lib/http/respond.ts
import "server-only";

import { noStoreHeaders } from "@/lib/http/noStore";
import { opsLog } from "@/lib/ops/log";

/* =========================================================
   RID
========================================================= */

function genRid(prefix = "rid") {
  // Kort, logg-vennlig, sortérbar (tid først) + god kollisjonssikring
  const t = Date.now().toString(36);
  const r1 = Math.random().toString(36).slice(2, 10);
  const r2 = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${t}_${r1}${r2}`;
}

export function makeRid(prefix = "rid"): string {
  return genRid(prefix);
}

/* =========================================================
   Helpers
========================================================= */

function normalizeError(err: unknown): string {
  if (err === undefined || err === null) return "ERROR";
  if (typeof err === "string") return err || "ERROR";
  if (err instanceof Error) return err.name || err.message || "ERROR";

  if (typeof err === "object") {
    const e = err as any;
    if (typeof e.code === "string" && e.code) return e.code;
    if (typeof e.error === "string" && e.error) return e.error;
    if (typeof e.name === "string" && e.name) return e.name;
    if (typeof e.message === "string" && e.message) return e.message;
  }

  return "ERROR";
}

function allowDetail(): boolean {
  // RC-mode eller ikke-production gir detaljer
  if (process.env.RC_MODE === "true") return true;
  if (process.env.NODE_ENV && process.env.NODE_ENV !== "production") return true;
  return false;
}

function toSafeJson(value: unknown): string {
  // Robust stringify uten "stille feil": vi returnerer alltid noe JSON
  try {
    return JSON.stringify(value);
  } catch {
    try {
      // siste utvei: minimal safe payload
      return JSON.stringify({ ok: false, error: "JSON_STRINGIFY_FAILED" });
    } catch {
      return '{"ok":false,"error":"JSON_STRINGIFY_FAILED"}';
    }
  }
}

function buildJsonHeaders(rid: string, extra?: HeadersInit): Headers {
  const h = new Headers();

  // Base: no-store
  const base = noStoreHeaders() as Record<string, string>;
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === "string" && v.length) h.set(k, v);
  }

  // Always JSON UTF-8
  h.set("content-type", "application/json; charset=utf-8");

  // Request ID propagation
  h.set("x-rid", rid);

  // Optional extras
  if (extra) {
    const eh = new Headers(extra);
    eh.forEach((v, k) => {
      if (typeof v === "string") h.set(k, v);
    });
  }

  return h;
}

function jsonResponse(body: unknown, status: number, rid: string, extraHeaders?: HeadersInit): Response {
  return new Response(toSafeJson(body), {
    status,
    headers: buildJsonHeaders(rid, extraHeaders),
  });
}

/* =========================================================
   Success
========================================================= */

/**
 * Standard OK-respons.
 * - Always { ok:true, rid, data }
 * - For konsistens: data blir null hvis undefined
 */
export function jsonOk<T>(rid: string, data: T, status = 200, extraHeaders?: HeadersInit): Response {
  try {
    return jsonResponse(
      {
        ok: true as const,
        rid,
        data: (data ?? null) as any,
      },
      status,
      rid,
      extraHeaders
    );
  } catch (e) {
    const rid2 = makeRid();
    const errorOut = normalizeError(e);

    try {
      opsLog("incident", {
        rid: rid2,
        status: 500,
        message: "RESPOND_FAILED",
        error: errorOut,
        meta: { originalRid: rid, kind: "jsonOk" },
      });
    } catch {
      // ignore
    }

    return jsonResponse(
      {
        ok: false as const,
        rid: rid2,
        message: "Kunne ikke generere respons.",
        status: 500,
        error: "RESPOND_FAILED",
      },
      500,
      rid2
    );
  }
}

/* =========================================================
   Error
========================================================= */

// Backwards compatible:
// jsonErr(rid, message)
// jsonErr(rid, message, status)
// jsonErr(rid, message, status, error)
// jsonErr(rid, message, status, error, detail)
// jsonErr(rid, message, status, error, detail, extraHeaders)

export function jsonErr(
  rid: string,
  message: string,
  status = 400,
  error?: unknown,
  detail?: unknown,
  extraHeaders?: HeadersInit
): Response {
  try {
    const errorOut = normalizeError(error);

    const payload: any = {
      ok: false as const,
      rid,
      message,
      status,
      error: errorOut,
    };

    const withDetail = allowDetail() && detail !== undefined;
    if (withDetail) payload.detail = detail;

    // Log incidents for 5xx (best effort)
    if (status >= 500) {
      try {
        opsLog("incident", {
          rid,
          status,
          message,
          error: errorOut,
          ...(withDetail ? { detail } : {}),
        });
      } catch {
        // ignore
      }
    }

    return jsonResponse(payload, status, rid, extraHeaders);
  } catch (e) {
    const rid2 = makeRid();
    const errorOut = normalizeError(e);

    try {
      opsLog("incident", {
        rid: rid2,
        status: 500,
        message: "RESPOND_FAILED",
        error: errorOut,
        meta: { originalRid: rid, originalStatus: status, kind: "jsonErr" },
      });
    } catch {
      // ignore
    }

    return jsonResponse(
      {
        ok: false as const,
        rid: rid2,
        message: "Kunne ikke generere feilrespons.",
        status: 500,
        error: "RESPOND_FAILED",
      },
      500,
      rid2
    );
  }
}

/* =========================================================
   Thrown helper (valgfri men anbefalt)
========================================================= */

/**
 * Konverterer en thrown error til en deterministisk 500-respons.
 * - I prod: skjuler detaljer (fail-closed)
 * - I RC/dev: inkluderer err i detail
 */
export function jsonFromThrown(
  rid: string,
  err: unknown,
  fallbackMessage = "Internal error",
  extraHeaders?: HeadersInit
): Response {
  const errorOut = normalizeError(err);

  const safeMessage =
    allowDetail() && err instanceof Error && typeof err.message === "string" && err.message
      ? err.message
      : fallbackMessage;

  return jsonErr(
    rid,
    safeMessage,
    500,
    errorOut,
    allowDetail() ? err : undefined,
    extraHeaders
  );
}

/* =========================================================
   Convenience helpers (valgfri, men nyttige)
========================================================= */

export function jsonBlocked(rid: string, message: string, code = "BLOCKED", detail?: unknown): Response {
  return jsonErr(rid, message, 400, code, detail);
}

export function jsonUnauthorized(rid: string, message = "Unauthorized", detail?: unknown): Response {
  return jsonErr(rid, message, 401, "UNAUTHORIZED", detail);
}

export function jsonForbidden(rid: string, message = "Forbidden", detail?: unknown): Response {
  return jsonErr(rid, message, 403, "FORBIDDEN", detail);
}

export function jsonNotFound(rid: string, message = "Not found", detail?: unknown): Response {
  return jsonErr(rid, message, 404, "NOT_FOUND", detail);
}
