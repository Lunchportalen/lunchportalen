// app/api/cron/forecast/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { osloTodayISODate } from "@/lib/date/oslo";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isISODate(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function addDaysISO(dateISO: string, days: number) {
  const d = new Date(`${dateISO}T12:00:00+01:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function log(scope: string, payload: any) {
  try {
    console.log(`[cron:${scope}]`, payload);
  } catch {}
}

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const anyAdmin: any = supabaseAdmin as any;
  return typeof anyAdmin === "function" ? await anyAdmin() : anyAdmin;
}

async function logCronRun(
  admin: any,
  payload: { job: string; status: "ok" | "error"; rid: string; detail?: string | null; meta?: Record<string, any> }
) {
  try {
    await admin.from("cron_runs").insert({
      job: payload.job,
      status: payload.status,
      rid: payload.rid,
      detail: payload.detail ?? null,
      meta: payload.meta ?? {},
    });
  } catch {}
}

export async function GET(req: Request) {
  const rid = makeRid();

  try {
    requireCronAuth(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();
    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i env", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate", 500, { code: "server_error", detail: { message: msg } });
  }

  const today = osloTodayISODate();
  const fromDefault = today;
  const toDefault = addDaysISO(today, 13);

  const url = new URL(req.url);
  const fromQ = url.searchParams.get("from");
  const toQ = url.searchParams.get("to");
  const modelQ = safeStr(url.searchParams.get("model") ?? "v1") || "v1";

  const fromFinal = isISODate(fromQ) ? String(fromQ) : fromDefault;
  const toFinal = isISODate(toQ) ? String(toQ) : toDefault;

  const meta = { from: fromFinal, to: toFinal, model: modelQ };

  log("forecast:start", { rid, ...meta });

  try {
    const admin = await getAdminClient();

    const { data, error } = await admin.rpc("lp_generate_forecast_range", {
      p_from: fromFinal,
      p_to: toFinal,
      p_model_version: modelQ,
    });

    if (error) {
      log("forecast:error", { rid, message: (error as any).message ?? String(error), ...meta });

      await logCronRun(admin, {
        job: "forecast",
        status: "error",
        rid,
        detail: (error as any).message ?? String(error),
        meta,
      });

      return jsonErr(rid, "lp_generate_forecast_range feilet", 500, {
        code: "rpc_error",
        detail: {
          message: (error as any)?.message ?? String(error),
          code: (error as any)?.code ?? null,
          hint: (error as any)?.hint ?? null,
          details: (error as any)?.details ?? null,
          ...meta,
        },
      });
    }

    const upserts = data ?? 0;

    await logCronRun(admin, {
      job: "forecast",
      status: "ok",
      rid,
      meta: { ...meta, upserts },
    });

    log("forecast:done", { rid, upserts, ...meta });

    return jsonOk(rid, { ok: true, rid, ...meta, upserts }, 200);
  } catch (e: any) {
    const msg = String(e?.message ?? e);

    try {
      const admin = await getAdminClient();
      await logCronRun(admin, { job: "forecast", status: "error", rid, detail: msg, meta });
    } catch {}

    return jsonErr(rid, "Forecast cron feilet", 500, { code: "server_error", detail: { message: msg, ...meta } });
  }
}
