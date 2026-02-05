// app/api/cron/preprod/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { osloTodayISODate } from "@/lib/date/oslo";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

/**
 * =========================================================
 * CRON: preprod signals (Dag-10 clean)
 * - NO cookies / NO scope
 * - x-cron-secret gate (Authorization: Bearer supported)
 * - (Optional legacy) GET ?key=CRON_SECRET supported
 * - uses SERVICE ROLE for RPC + logging (cron_runs)
 * - no-store + { ok, rid }
 *
 * RPC:
 * - lp_generate_signals_for_date(p_date)
 * =========================================================
 */

/* =========================================================
   Cron secret gate (fail-closed)
   - Prefer: header x-cron-secret
   - Support: Authorization: Bearer <secret>
   - Optional legacy: GET ?key=<secret>
========================================================= */
function requireCronSecret(req: Request, allowQueryKey = true) {
  const want = (process.env.CRON_SECRET ?? "").trim();
  if (!want) throw new Error("cron_secret_missing");

  const hdr = (req.headers.get("x-cron-secret") ?? "").trim();
  const auth = (req.headers.get("authorization") ?? "").trim();
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const token = hdr || bearer;

  if (token) {
    if (token !== want) {
      const err = new Error("forbidden");
      (err as any).code = "forbidden";
      throw err;
    }
    return;
  }

  if (allowQueryKey) {
    const url = new URL(req.url);
    const key = (url.searchParams.get("key") ?? "").trim();
    if (key && key === want) return;
  }

  const err = new Error("forbidden");
  (err as any).code = "forbidden";
  throw err;
}

/* =========================================================
   Supabase admin client
   - Cron MUST NOT use cookie/session client
========================================================= */
async function getAdminClient() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const anyAdmin: any = supabaseAdmin as any;
  return typeof anyAdmin === "function" ? await anyAdmin() : anyAdmin;
}

/* =========================================================
   Logging helpers (fail-quiet)
========================================================= */
function log(scope: string, payload: any) {
  try {
    console.log(`[cron:${scope}]`, payload);
  } catch {
    // no-op
  }
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
  } catch {
    // no-op
  }
}

/* =========================================================
   GET /api/cron/preprod
========================================================= */
export async function GET(req: Request) {
  const rid = makeRid();

  // Gate first
  try {
    requireCronSecret(req, true);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "cron_secret_missing") return jsonErr(rid, "CRON_SECRET mangler i env", 500, "misconfigured");
    if (msg === "forbidden" || e?.code === "forbidden") return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    return jsonErr(rid, "Uventet feil i cron-gate", 500, { code: "server_error", detail: { message: msg } });
  }

  const today = osloTodayISODate();
  const meta = { date: today };

  log("preprod:start", { rid, ...meta });

  try {
    const admin = await getAdminClient();

    const { data, error } = await admin.rpc("lp_generate_signals_for_date", { p_date: today });

    if (error) {
      log("preprod:error", { rid, ...meta, message: error.message });

      await logCronRun(admin, {
        job: "preprod",
        status: "error",
        rid,
        detail: error.message,
        meta,
      });

      return jsonErr(rid, "lp_generate_signals_for_date feilet", 500, { code: "rpc_error", detail: {
        message: error.message ?? String(error),
        code: (error as any)?.code ?? null,
        hint: (error as any)?.hint ?? null,
        details: (error as any)?.details ?? null,
        ...meta,
      } });
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

    // Best effort: try to log
    try {
      const admin = await getAdminClient();
      await logCronRun(admin, { job: "preprod", status: "error", rid, detail: msg, meta });
    } catch {}

    return jsonErr(rid, "Preprod cron feilet", 500, { code: "server_error", detail: { message: msg, ...meta } });
  }
}
