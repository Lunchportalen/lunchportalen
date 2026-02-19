// app/api/cron/esg/lock/yearly/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

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
    if (msg === "cron_secret_missing" || code === "cron_secret_missing") return jsonErr(rid, "CRON_SECRET mangler", 500, "misconfigured");
    if (msg === "forbidden" || code === "forbidden") return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    return jsonErr(rid, "Uventet feil i cron-gate", 500, { code: "server_error", detail: { message: msg } });
  }

  const url = new URL(req.url);

  const currentYear = osloYear();
  const yearRaw = url.searchParams.get("year");
  const year = clampYear(Number(yearRaw ?? (currentYear - 1)));

  const force = (url.searchParams.get("force") ?? "").trim() === "1";

  try {
    const admin = await getAdminClient();

    const { data, error } = await admin.rpc("esg_lock_yearly", { p_year: year, p_force: force });

    if (error) {
      return jsonErr(rid, "esg_lock_yearly feilet", 500, { code: "rpc_error", detail: {
        message: error.message ?? String(error),
        code: (error as any)?.code ?? null,
        hint: (error as any)?.hint ?? null,
        details: (error as any)?.details ?? null,
      } });
    }

    return jsonOk(rid, { ok: true, rid, year, force, result: data }, 200);
  } catch (e: any) {
    return jsonErr(rid, "ESG yearly cron feilet", 500, { code: "server_error", detail: { message: String(e?.message ?? e), year, force } });
  }
}
