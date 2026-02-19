// app/api/cron/esg/yearly/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function clampYear(n: number) {
  if (!Number.isFinite(n)) return new Date().getFullYear();
  const y = Math.trunc(n);
  if (y < 2000) return 2000;
  if (y > 2100) return 2100;
  return y;
}

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const anyAdmin: any = supabaseAdmin as any;
  return typeof anyAdmin === "function" ? await anyAdmin() : anyAdmin;
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    requireCronAuth(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();
    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate", 500, { code: "server_error", detail: { message: msg } });
  }

  const url = new URL(req.url);
  const yearRaw = url.searchParams.get("year");
  const year = clampYear(Number(yearRaw ?? new Date().getFullYear()));

  if (!Number.isInteger(year)) {
    return jsonErr(rid, "year ma vaere heltall", 400, { code: "bad_request", detail: { year: yearRaw } });
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
