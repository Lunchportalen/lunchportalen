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

function requireCronSecret(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) return { ok: false, status: 500, message: "CRON_SECRET mangler" as const };

  const hdr = req.headers.get("x-cron-secret") || "";
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  const got = hdr || bearer;

  if (got !== expected) return { ok: false, status: 401, message: "Ugyldig cron secret" as const };
  return { ok: true as const };
}

function osloYear() {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric" });
  return Number(fmt.format(new Date()));
}

function clampYear(n: number) {
  if (!Number.isFinite(n)) return osloYear() - 1;
  const y = Math.trunc(n);
  if (y < 2000) return 2000;
  if (y > 2100) return 2100;
  return y;
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

  // Default: lock previous year
  const url = new URL(req.url);
  const currentYear = osloYear();

  const yearRaw = url.searchParams.get("year");
  const year = clampYear(Number(yearRaw ?? (currentYear - 1)));

  const force = url.searchParams.get("force") === "1";

  const admin = await getAdminClient();

  const { data, error } = await admin.rpc("esg_lock_yearly", { p_year: year, p_force: force });
  if (error) return jsonErr(500, rid, "RPC_ERROR", "esg_lock_yearly feilet", error);

  return jsonOk({ ok: true, rid, year, force, result: data });
}
