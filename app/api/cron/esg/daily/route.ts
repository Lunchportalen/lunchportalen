// app/api/cron/esg/daily/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

/* =========================================================
   Dag-10: no-store + consistent JSON
========================================================= */
function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" } as const;
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}

/* =========================================================
   Helpers
========================================================= */
function isISODate(v: any) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Oslo "today" uten ekstern pakke */
function osloTodayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // en-CA => YYYY-MM-DD
}

/* =========================================================
   Cron secret gate (NO cookies / NO scope) - fail closed
   - Header: x-cron-secret: <CRON_SECRET>
   - Authorization: Bearer <CRON_SECRET> (supported)
========================================================= */
function requireCronSecret(req: NextRequest) {
  const expected = (process.env.CRON_SECRET ?? "").trim();
  if (!expected) throw new Error("cron_secret_missing");

  const hdr = (req.headers.get("x-cron-secret") ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").trim();
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";

  const got = hdr || bearer;
  if (!got || got !== expected) {
    const err = new Error("forbidden");
    (err as any).code = "forbidden";
    throw err;
  }
}

/* =========================================================
   Supabase admin client
   - supports both factory and instance variants
========================================================= */
async function getAdminClient() {
  const anyAdmin: any = supabaseAdmin as any;
  return typeof anyAdmin === "function" ? await anyAdmin() : anyAdmin;
}

/* =========================================================
   POST /api/cron/esg/daily?date=YYYY-MM-DD
   - idempotent as long as RPC is idempotent for the date
========================================================= */
export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID?.() ?? `esg_daily_${Date.now().toString(36)}`;

  // Gate FIRST (no side effects before secret validated)
  try {
    requireCronSecret(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "cron_secret_missing") return jsonErr(500, rid, "misconfigured", "CRON_SECRET mangler i env");
    if (msg === "forbidden" || e?.code === "forbidden") return jsonErr(403, rid, "forbidden", "Ugyldig cron secret");
    return jsonErr(500, rid, "server_error", "Uventet feil i cron-gate", { message: msg });
  }

  const url = new URL(req.url);
  const date = (url.searchParams.get("date") ?? "").trim() || osloTodayISO();
  if (!isISODate(date)) return jsonErr(400, rid, "bad_request", "date må være YYYY-MM-DD", { date });

  try {
    const admin = await getAdminClient();

    // RPC is the source of truth for ESG aggregation
    const { data, error } = await admin.rpc("esg_build_daily", { p_date: date });

    if (error) {
      return jsonErr(500, rid, "rpc_error", "esg_build_daily feilet", {
        message: error.message ?? String(error),
        code: (error as any)?.code ?? null,
        hint: (error as any)?.hint ?? null,
        details: (error as any)?.details ?? null,
      });
    }

    return jsonOk({ ok: true, rid, date, result: data }, 200);
  } catch (e: any) {
    return jsonErr(500, rid, "server_error", "ESG daily cron feilet", { message: String(e?.message ?? e), date });
  }
}
