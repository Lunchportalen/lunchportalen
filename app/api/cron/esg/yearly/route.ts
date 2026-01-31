// app/api/cron/esg/yearly/build/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

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
  return NextResponse.json(
    { ok: false, rid, error, message, detail: detail ?? undefined },
    { status, headers: noStore() }
  );
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
   Helpers
========================================================= */
function clampYear(n: number) {
  if (!Number.isFinite(n)) return new Date().getFullYear();
  const y = Math.trunc(n);
  if (y < 2000) return 2000;
  if (y > 2100) return 2100;
  return y;
}

/* =========================================================
   Supabase admin client
   - supports both factory and instance variants
========================================================= */
async function getAdminClient() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const anyAdmin: any = supabaseAdmin as any;
  return typeof anyAdmin === "function" ? await anyAdmin() : anyAdmin;
}

/* =========================================================
   POST /api/cron/esg/yearly/build?year=YYYY
   Default: current year (Oslo/UTC-agnostic)
========================================================= */
export async function POST(req: NextRequest) {
  const rid = crypto.randomUUID?.() ?? `esg_build_yearly_${Date.now().toString(36)}`;

  // Gate FIRST (no side effects before secret validated)
  try {
    requireCronSecret(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "cron_secret_missing") {
      return jsonErr(500, rid, "misconfigured", "CRON_SECRET mangler");
    }
    if (msg === "forbidden" || e?.code === "forbidden") {
      return jsonErr(403, rid, "forbidden", "Ugyldig cron secret");
    }
    return jsonErr(500, rid, "server_error", "Uventet feil i cron-gate", { message: msg });
  }

  const url = new URL(req.url);
  const yearRaw = url.searchParams.get("year");
  const year = clampYear(Number(yearRaw ?? new Date().getFullYear()));

  if (!Number.isInteger(year)) {
    return jsonErr(400, rid, "bad_request", "year må være heltall", { year: yearRaw });
  }

  try {
    const admin = await getAdminClient();

    const { data, error } = await admin.rpc("esg_build_yearly", { p_year: year });

    if (error) {
      return jsonErr(500, rid, "rpc_error", "esg_build_yearly feilet", {
        message: error.message ?? String(error),
        code: (error as any)?.code ?? null,
        hint: (error as any)?.hint ?? null,
        details: (error as any)?.details ?? null,
      });
    }

    return jsonOk({ ok: true, rid, year, result: data }, 200);
  } catch (e: any) {
    return jsonErr(500, rid, "server_error", "ESG build yearly cron feilet", {
      message: String(e?.message ?? e),
      year,
    });
  }
}
