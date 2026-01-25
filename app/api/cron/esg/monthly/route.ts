// app/api/cron/esg/monthly/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" };
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return NextResponse.json({ ok: false, rid, error, message, detail: detail ?? undefined }, { status, headers: noStore() });
}
function jsonOk(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function isIsoMonth01(v: any) {
  return typeof v === "string" && /^\d{4}-\d{2}-01$/.test(v);
}

function osloMonthStartISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const today = fmt.format(new Date()); // YYYY-MM-DD
  return today.slice(0, 8) + "01"; // YYYY-MM-01
}

function requireCronSecret(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return { ok: false, status: 500, message: "CRON_SECRET mangler i env" as const };

  const hdr = req.headers.get("x-cron-secret") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  const got = hdr || bearer;

  if (got !== expected) return { ok: false, status: 401, message: "Ugyldig cron secret" as const };
  return { ok: true as const };
}

// ✅ håndter både "client" og "factory"
async function getAdminClient() {
  const anyAdmin: any = supabaseAdmin as any;
  return typeof anyAdmin === "function" ? await anyAdmin() : anyAdmin;
}

export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID?.() ?? String(Date.now());

  const guard = requireCronSecret(req);
  if (!guard.ok) return jsonErr(guard.status, rid, "UNAUTHORIZED", guard.message);

  const url = new URL(req.url);
  const month = url.searchParams.get("month") || osloMonthStartISO();
  if (!isIsoMonth01(month)) return jsonErr(400, rid, "BAD_REQUEST", "month må være YYYY-MM-01", { month });

  const admin = await getAdminClient();

  const { data, error } = await admin.rpc("esg_build_monthly", { p_month: month });
  if (error) return jsonErr(500, rid, "RPC_ERROR", "esg_build_monthly feilet", error);

  return jsonOk({ ok: true, rid, month, result: data });
}
