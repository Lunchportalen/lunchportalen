// app/api/cron/esg/yearly/build/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

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
  const rid = makeRid();

  // Gate FIRST (no side effects before secret validated)
  try {
    requireCronSecret(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler", 500, "misconfigured");
    }
    if (msg === "forbidden" || e?.code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate", 500, { code: "server_error", detail: { message: msg } });
  }

  const url = new URL(req.url);
  const yearRaw = url.searchParams.get("year");
  const year = clampYear(Number(yearRaw ?? new Date().getFullYear()));

  if (!Number.isInteger(year)) {
    return jsonErr(rid, "year må være heltall", 400, { code: "bad_request", detail: { year: yearRaw } });
  }

  try {
    const admin = await getAdminClient();

    const { data, error } = await admin.rpc("esg_build_yearly", { p_year: year });

    if (error) {
      return jsonErr(rid, "esg_build_yearly feilet", 500, { code: "rpc_error", detail: {
        message: error.message ?? String(error),
        code: (error as any)?.code ?? null,
        hint: (error as any)?.hint ?? null,
        details: (error as any)?.details ?? null,
      } });
    }

    return jsonOk(rid, { ok: true, rid, year, result: data }, 200);
  } catch (e: any) {
    return jsonErr(rid, "ESG build yearly cron feilet", 500, { code: "server_error", detail: {
      message: String(e?.message ?? e),
      year,
    } });
  }
}
