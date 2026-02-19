// app/api/cron/esg/daily/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { type NextRequest } from "next/server";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function isISODate(v: any) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

function osloTodayISO(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
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
    if (msg === "cron_secret_missing" || code === "cron_secret_missing") return jsonErr(rid, "CRON_SECRET mangler i env", 500, "misconfigured");
    if (msg === "forbidden" || code === "forbidden") return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    return jsonErr(rid, "Uventet feil i cron-gate", 500, { code: "server_error", detail: { message: msg } });
  }

  const url = new URL(req.url);
  const date = (url.searchParams.get("date") ?? "").trim() || osloTodayISO();
  if (!isISODate(date)) return jsonErr(rid, "date ma vaere YYYY-MM-DD", 400, { code: "bad_request", detail: { date } });

  try {
    const admin = await getAdminClient();
    const { data, error } = await admin.rpc("esg_build_daily", { p_date: date });

    if (error) {
      return jsonErr(rid, "esg_build_daily feilet", 500, { code: "rpc_error", detail: {
        message: error.message ?? String(error),
        code: (error as any)?.code ?? null,
        hint: (error as any)?.hint ?? null,
        details: (error as any)?.details ?? null,
      } });
    }

    return jsonOk(rid, { ok: true, rid, date, result: data }, 200);
  } catch (e: any) {
    return jsonErr(rid, "ESG daily cron feilet", 500, { code: "server_error", detail: { message: String(e?.message ?? e), date } });
  }
}
