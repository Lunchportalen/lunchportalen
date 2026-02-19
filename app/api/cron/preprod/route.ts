// app/api/cron/preprod/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { osloTodayISODate } from "@/lib/date/oslo";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

async function getAdminClient() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const anyAdmin: any = supabaseAdmin as any;
  return typeof anyAdmin === "function" ? await anyAdmin() : anyAdmin;
}

function log(scope: string, payload: any) {
  try {
    console.log(`[cron:${scope}]`, payload);
  } catch {}
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
  const meta = { date: today };

  log("preprod:start", { rid, ...meta });

  try {
    const admin = await getAdminClient();

    const { data, error } = await admin.rpc("lp_generate_signals_for_date", { p_date: today });

    if (error) {
      const emsg = (error as any)?.message ?? String(error);
      log("preprod:error", { rid, ...meta, message: emsg });

      await logCronRun(admin, {
        job: "preprod",
        status: "error",
        rid,
        detail: emsg,
        meta,
      });

      return jsonErr(rid, "lp_generate_signals_for_date feilet", 500, {
        code: "rpc_error",
        detail: {
          message: emsg,
          code: (error as any)?.code ?? null,
          hint: (error as any)?.hint ?? null,
          details: (error as any)?.details ?? null,
          ...meta,
        },
      });
    }

    const upserted = data ?? 0;

    await logCronRun(admin, {
      job: "preprod",
      status: "ok",
      rid,
      meta: { ...meta, signals_upserted: upserted },
    });

    log("preprod:done", { rid, ...meta, signals_upserted: upserted });

    return jsonOk(rid, { ok: true, rid, ...meta, signals_upserted: upserted }, 200);
  } catch (e: any) {
    const msg = String(e?.message ?? e);

    try {
      const admin = await getAdminClient();
      await logCronRun(admin, { job: "preprod", status: "error", rid, detail: msg, meta });
    } catch {}

    return jsonErr(rid, "Preprod cron feilet", 500, { code: "server_error", detail: { message: msg, ...meta } });
  }
}
