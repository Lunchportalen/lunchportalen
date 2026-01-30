// app/api/admin/metrics/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { osloTodayISODate } from "@/lib/date/oslo";

// ✅ Dag-10 standard: respond + routeGuard (rid + no-store + ok-contract)
import { jsonOk, jsonErr } from "@/lib/http/respond";
import { scopeOr401, requireRoleOr403, requireCompanyScopeOr403 } from "@/lib/http/routeGuard";

/**
 * Admin metrics "router" (read-only)
 * ---------------------------------------------------------
 * Samler én inngang for metrics i admin:
 * - summary (default)
 * - daily
 * - weekly
 * - insight
 *
 * Implementasjon:
 * - vi gjør server-side fetch mot interne routes (samme app)
 * - videresender cookies/header fra request
 * - returnerer downstream-respons (ok:true/false) uten å endre kontrakt
 *
 * NB: Dette endepunktet gjør ingen DB-kall selv, kun delegasjon.
 */

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function pickMode(v: string | null): "summary" | "daily" | "weekly" | "insight" {
  const s = safeStr(v).toLowerCase();
  if (s === "daily") return "daily";
  if (s === "weekly") return "weekly";
  if (s === "insight") return "insight";
  return "summary";
}

function originFromReq(req: NextRequest): string {
  // NextRequest.url er full URL i App Router
  try {
    const u = new URL(req.url);
    return `${u.protocol}//${u.host}`;
  } catch {
    // fallback
    return "http://localhost:3000";
  }
}

function forwardHeaders(req: NextRequest): HeadersInit {
  // Viktig: forward cookies for auth/session
  const h = new Headers();
  const cookie = req.headers.get("cookie");
  if (cookie) h.set("cookie", cookie);

  const auth = req.headers.get("authorization");
  if (auth) h.set("authorization", auth);

  // For debug/sporing i logs downstream
  const ua = req.headers.get("user-agent");
  if (ua) h.set("user-agent", ua);

  const accept = req.headers.get("accept");
  if (accept) h.set("accept", accept);

  return h;
}

async function passThrough(req: NextRequest, url: string) {
  const res = await fetch(url, {
    method: "GET",
    headers: forwardHeaders(req),
    cache: "no-store",
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: {
      // behold downstream content-type hvis den finnes
      "content-type": res.headers.get("content-type") ?? "application/json; charset=utf-8",
      // no-store + rid skal alltid finnes i våre jsonErr/jsonOk, men vi sikrer no-store uansett
      "Cache-Control": "no-store, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET(req: NextRequest) {
  const a = await scopeOr401(req);
  if (a.ok === false) return a.res;

  const { rid } = a.ctx;

  const denyRole = requireRoleOr403(a.ctx, "admin.metrics.read", ["company_admin"]);
  if (denyRole) return denyRole;

  const denyScope = requireCompanyScopeOr403(a.ctx);
  if (denyScope) return denyScope;

  try {
    const url = new URL(req.url);
    const mode = pickMode(url.searchParams.get("mode"));

    // Pass-through query params (days/weeks osv.)
    const qs = new URLSearchParams(url.searchParams);
    qs.delete("mode");

    const origin = originFromReq(req);

    let targetPath = "/api/admin/metrics/summary";
    if (mode === "daily") targetPath = "/api/admin/metrics/daily";
    if (mode === "weekly") targetPath = "/api/admin/metrics/weekly";
    if (mode === "insight") targetPath = "/api/admin/insight";

    const targetUrl = `${origin}${targetPath}${qs.toString() ? `?${qs.toString()}` : ""}`;

    return await passThrough(req, targetUrl);
  } catch (e: any) {
    return jsonErr(500, rid, "UNHANDLED", "Uventet feil.", {
      message: String(e?.message ?? e),
      hint: "Bruk ?mode=summary|daily|weekly|insight",
      today: osloTodayISODate(),
    });
  }
}
