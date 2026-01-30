// lib/http/respond.ts
import "server-only";

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { noStoreHeaders } from "@/lib/http/noStore";

/**
 * Response helpers (bakoverkompatibel)
 * - rid(req?) -> støtter x-rid / x-request-id / x-correlation-id
 * - jsonOk(ctx, body, status?)  OG  jsonOk(body, status?)
 * - jsonErr(...) -> støtter flere signaturer for legacy-kall
 *
 * Mål:
 * - 100% deterministisk rid-strategi
 * - no-store på ALT (via noStore.ts som eneste fasit)
 * - aldri kaste
 */

export type CtxLike = { rid: string };

/* =========================================================
   Utils
========================================================= */
function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * Robust rid uten crypto-import (Edge/Node-safe).
 * Ikke kryptografisk, men stabilt nok til korrelasjon.
 */
function genRid() {
  const t = Date.now().toString(36);
  const r1 = Math.random().toString(36).slice(2, 10);
  const r2 = Math.random().toString(36).slice(2, 10);
  return `rid_${t}_${r1}${r2}`;
}

/**
 * rid generator (kan kalles som rid() eller rid(req))
 * Prioritet: x-rid -> x-request-id -> x-correlation-id -> genRid()
 */
export function rid(req?: NextRequest): string {
  try {
    if (req) {
      const a = safeStr(req.headers.get("x-rid"));
      if (a) return a;

      const b = safeStr(req.headers.get("x-request-id"));
      if (b) return b;

      const c = safeStr(req.headers.get("x-correlation-id"));
      if (c) return c;
    }
  } catch {
    // ignore
  }
  return genRid();
}

/**
 * Hent rid fra ctx eller string.
 * Returnerer "" hvis den ikke klarer å hente en gyldig rid.
 */
function ctxRid(x: unknown): string {
  try {
    if (x && typeof x === "object" && typeof (x as any).rid === "string") {
      const r = safeStr((x as any).rid);
      return r || "";
    }
  } catch {
    // ignore
  }
  return safeStr(x);
}

/* =========================================================
   jsonOk
========================================================= */
/**
 * jsonOk overloads:
 *  A) jsonOk(ctx, body, status?)
 *  B) jsonOk(body, status?)
 */
export function jsonOk(ctx: CtxLike, body: any, status?: number): Response;
export function jsonOk(body: any, status?: number): Response;
export function jsonOk(...args: any[]): Response {
  try {
    // A) (ctx, body, status?)
    if (args[0] && typeof args[0] === "object" && typeof args[0].rid === "string") {
      const body = args[1] ?? {};
      const status = typeof args[2] === "number" ? args[2] : 200;
      return NextResponse.json(body, { status, headers: noStoreHeaders() });
    }

    // B) (body, status?)
    const body = args[0] ?? {};
    const status = typeof args[1] === "number" ? args[1] : 200;
    return NextResponse.json(body, { status, headers: noStoreHeaders() });
  } catch {
    // Siste skanse: aldri throw fra respond helpers
    return NextResponse.json({ ok: false as const, rid: genRid(), error: "RESPOND_FAILED", message: "Kunne ikke generere respons." }, { status: 500, headers: noStoreHeaders() });
  }
}

/* =========================================================
   jsonErr
========================================================= */
/**
 * jsonErr overloads (bakoverkompat):
 *  A) jsonErr(status, ctx, error, message, detail?)
 *  B) jsonErr(status, rid, error, message, detail?)
 *  C) jsonErr(ctx, error, message, detail?)
 *  D) jsonErr(rid, error, message, detail?)
 *
 * Merk:
 * - rid kommer ALLTID i payload (og er alltid non-empty).
 * - detail inkluderes bare når den faktisk er definert.
 */
export function jsonErr(status: number, ctx: CtxLike, error: string, message: string, detail?: any): Response;
export function jsonErr(status: number, rid: string, error: string, message: string, detail?: any): Response;
export function jsonErr(ctx: CtxLike, error: string, message: string, detail?: any): Response;
export function jsonErr(rid: string, error: string, message: string, detail?: any): Response;
export function jsonErr(...args: any[]): Response {
  let status = 400;
  let ctxOrRid: any;
  let error = "ERROR";
  let message = "Ukjent feil";
  let detail: any = undefined;

  try {
    // status-first varianter
    if (typeof args[0] === "number") {
      status = args[0];
      ctxOrRid = args[1];
      error = safeStr(args[2]) || error;
      message = safeStr(args[3]) || message;
      detail = args[4];
    } else {
      // uten status: (ctx|rid, error, message, detail?)
      ctxOrRid = args[0];
      error = safeStr(args[1]) || error;
      message = safeStr(args[2]) || message;
      detail = args[3];
    }

    const ridVal = ctxRid(ctxOrRid) || genRid();

    const payload =
      detail === undefined
        ? ({ ok: false as const, rid: ridVal, error, message } as const)
        : ({ ok: false as const, rid: ridVal, error, message, detail } as const);

    return NextResponse.json(payload, { status, headers: noStoreHeaders() });
  } catch {
    // Siste skanse: aldri throw, alltid rid + no-store
    return NextResponse.json(
      { ok: false as const, rid: genRid(), error: "RESPOND_FAILED", message: "Kunne ikke generere feilrespons." },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
