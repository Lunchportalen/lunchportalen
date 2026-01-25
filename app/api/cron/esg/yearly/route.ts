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

function clampYear(n: number) {
  if (!Number.isFinite(n)) return new Date().getFullYear();
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

  const url = new URL(req.url);
  const yearRaw = url.searchParams.get("year");
  const year = clampYear(Number(yearRaw ?? new Date().getFullYear()));

  // fortsatt krav: må være heltall
  if (!Number.isInteger(year)) return jsonErr(400, rid, "BAD_REQUEST", "year må være heltall", { year: yearRaw });

  const admin = await getAdminClient();

  const { data, error } = await admin.rpc("esg_build_yearly", { p_year: year });
  if (error) return jsonErr(500, rid, "RPC_ERROR", "esg_build_yearly feilet", error);

  return jsonOk({ ok: true, rid, year, result: data });
}
