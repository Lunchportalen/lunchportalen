// lib/http/respond.ts
import "server-only";

import { noStoreHeaders } from "@/lib/http/noStore";
import { opsLog } from "@/lib/ops/log";

/* =========================================================
   RID
========================================================= */

function genRid() {
  const t = Date.now().toString(36);
  const r1 = Math.random().toString(36).slice(2, 10);
  const r2 = Math.random().toString(36).slice(2, 10);
  return `rid_${t}_${r1}${r2}`;
}

export function makeRid(): string {
  return genRid();
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
  return new Response(JSON.stringify(body), {
    status,
    headers: buildJsonHeaders(rid, extraHeaders),
  });
}

/* =========================================================
   Success
========================================================= */

export function jsonOk<T>(rid: string, data: T, status = 200): Response {
  try {
    return jsonResponse(
      {
        ok: true as const,
        rid,
        data: data ?? null,
      },
      status,
      rid
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
        meta: { originalRid: rid },
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

export function jsonErr(
  rid: string,
  message: string,
  status = 400,
  error?: unknown,
  detail?: unknown
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

    return jsonResponse(payload, status, rid);
  } catch (e) {
    const rid2 = makeRid();
    const errorOut = normalizeError(e);

    try {
      opsLog("incident", {
        rid: rid2,
        status: 500,
        message: "RESPOND_FAILED",
        error: errorOut,
        meta: { originalRid: rid, originalStatus: status },
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

export function jsonFromThrown(rid: string, err: unknown, fallbackMessage = "Internal error"): Response {
  const errorOut = normalizeError(err);

  const safeMessage =
    allowDetail() && err instanceof Error
      ? err.message
      : fallbackMessage;

  return jsonErr(rid, safeMessage, 500, errorOut, allowDetail() ? err : undefined);
}
