// lib/http/respond.ts
import "server-only";

import { noStoreHeaders } from "@/lib/http/noStore";
import { opsLog } from "@/lib/ops/log";

function genRid() {
  const t = Date.now().toString(36);
  const r1 = Math.random().toString(36).slice(2, 10);
  const r2 = Math.random().toString(36).slice(2, 10);
  return `rid_${t}_${r1}${r2}`;
}

export function makeRid(): string {
  return genRid();
}

function normalizeError(err: unknown): string {
  if (err === undefined || err === null) return "ERROR";
  if (typeof err === "string") return err || "ERROR";
  if (err instanceof Error) return err.name || err.message || "ERROR";
  if (err && typeof err === "object") {
    const e = err as any;
    if (typeof e.code === "string" && e.code) return e.code;
    if (typeof e.error === "string" && e.error) return e.error;
    if (typeof e.name === "string" && e.name) return e.name;
    if (typeof e.message === "string" && e.message) return e.message;
  }
  return "ERROR";
}

function buildJsonHeaders(extra?: HeadersInit): Headers {
  const h = new Headers();

  // ✅ Fasit: no-store
  const base = noStoreHeaders() as Record<string, string>;
  for (const [k, v] of Object.entries(base)) {
    if (typeof v === "string" && v.length) h.set(k, v);
  }

  // ✅ Fasit: UTF-8 JSON
  h.set("content-type", "application/json; charset=utf-8");

  // Optional extras (still safe)
  if (extra) {
    const eh = new Headers(extra);
    eh.forEach((v, k) => {
      if (typeof v === "string") h.set(k, v);
    });
  }

  return h;
}

function jsonResponse(body: unknown, status: number, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: buildJsonHeaders(extraHeaders),
  });
}

export function jsonOk<T>(rid: string, data: T, status = 200): Response {
  try {
    return jsonResponse({ ok: true as const, rid, data: data ?? null }, status);
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
      { ok: false as const, rid: rid2, message: "Kunne ikke generere respons.", status: 500, error: "RESPOND_FAILED" },
      500
    );
  }
}

export function jsonErr(rid: string, message: string, status = 400, error?: unknown): Response {
  try {
    const errorOut = normalizeError(error);
    const payload = { ok: false as const, rid, message, status, error: errorOut };

    if (status >= 500) {
      try {
        opsLog("incident", { rid, status, message, error: errorOut });
      } catch {
        // ignore
      }
    }

    return jsonResponse(payload, status);
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
      { ok: false as const, rid: rid2, message: "Kunne ikke generere feilrespons.", status: 500, error: "RESPOND_FAILED" },
      500
    );
  }
}
