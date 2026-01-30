// app/api/cron/esg/monthly/route.ts
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
   Cron secret gate (fail-closed)
   - Header: x-cron-secret
   - Authorization: Bearer
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
   Date helpers (Oslo)
========================================================= */
function osloMonthStartISO(d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(d); // YYYY-MM-DD
  return today.slice(0, 8) + "01"; // YYYY-MM-01
}

function addMonths(isoMonth01: string, delta: number) {
  const [y, m] = isoMonth01.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function isIsoMonth01(v: any) {
  return typeof v === "string" && /^\d{4}-\d{2}-01$/.test(v);
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
   POST /api/cron/esg/monthly?month=YYYY-MM-01&force=1
   Default: locks previous month (Oslo)
========================================================= */
export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID?.() ?? `esg_monthly_${Date.now().toString(36)}`;

  // Gate FIRST (no side effects before secret validated)
  try {
    requireCronSecret(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "cron_secret_missing") return jsonErr(500, rid, "misconfigured", "CRON_SECRET mangler");
    if (msg === "forbidden" || e?.code === "forbidden") return jsonErr(403, rid, "forbidden", "Ugyldig cron secret");
    return jsonErr(500, rid, "server_error", "Uventet feil i cron-gate", { message: msg });
  }

  const url = new URL(req.url);

  // Default: lock previous month
  const thisMonth = osloMonthStartISO();
  const prevMonth = addMonths(thisMonth, -1);

  const month = (url.searchParams.get("month") ?? "").trim() || prevMonth;
  if (!isIsoMonth01(month)) {
    return jsonErr(400, rid, "bad_request", "month må være YYYY-MM-01", { month });
  }

  const force = (url.searchParams.get("force") ?? "").trim() === "1";

  try {
    const admin = await getAdminClient();

    const { data, error } = await admin.rpc("esg_lock_monthly", { p_month: month, p_force: force });

    if (error) {
      return jsonErr(500, rid, "rpc_error", "esg_lock_monthly feilet", {
        message: error.message ?? String(error),
        code: (error as any)?.code ?? null,
        hint: (error as any)?.hint ?? null,
        details: (error as any)?.details ?? null,
      });
    }

    return jsonOk({ ok: true, rid, month, force, result: data }, 200);
  } catch (e: any) {
    return jsonErr(500, rid, "server_error", "ESG monthly cron feilet", { message: String(e?.message ?? e), month, force });
  }
}
