// app/api/cron/forecast/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { osloTodayISODate } from "@/lib/date/oslo";

/**
 * =========================================================
 * CRON: forecast (Dag-10 clean)
 * - NO cookies / NO scope
 * - x-cron-secret gate (Authorization: Bearer supported)
 * - (Optional legacy) GET ?key=CRON_SECRET supported
 * - idempotent (RPC should be idempotent for same range/model)
 * - no-store + { ok, rid } + safe retry
 *
 * RPC:
 * - lp_generate_forecast_range(p_from, p_to, p_model_version)
 *
 * Optional query params:
 * - from=YYYY-MM-DD
 * - to=YYYY-MM-DD
 * - model=v1 (default)
 * - key=CRON_SECRET (legacy)
 * =========================================================
 */

/* =========================================================
   Response helpers
========================================================= */
function noStore() {
  return { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache", Expires: "0" } as const;
}
function json(body: any, status = 200) {
  return NextResponse.json(body, { status, headers: noStore() });
}
function jsonErr(status: number, rid: string, error: string, message: string, detail?: any) {
  return json({ ok: false, rid, error, message, detail: detail ?? undefined }, status);
}

/* =========================================================
   Helpers
========================================================= */
function isISODate(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// Keep as local-day math (Oslo) by anchoring at midday with Oslo offset.
// (DST-safe enough for date-only stepping; we avoid midnight edge cases.)
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
  } catch {
    // no-op
  }
}

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
   - Cron MUST NOT use cookies/session client
========================================================= */
async function getAdminClient() {
  const anyAdmin: any = supabaseAdmin as any;
  return typeof anyAdmin === "function" ? await anyAdmin() : anyAdmin;
}

/* =========================================================
   Optional: cron_runs logging (fail-quiet)
========================================================= */
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
   GET /api/cron/forecast
========================================================= */
export async function GET(req: Request) {
  const rid = crypto.randomUUID?.() ?? `forecast_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // Gate first
  try {
    requireCronSecret(req, true);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    if (msg === "cron_secret_missing") return jsonErr(500, rid, "misconfigured", "CRON_SECRET mangler i env");
    if (msg === "forbidden" || e?.code === "forbidden") return jsonErr(403, rid, "forbidden", "Ugyldig cron secret");
    return jsonErr(500, rid, "server_error", "Uventet feil i cron-gate", { message: msg });
  }

  const today = osloTodayISODate();
  const fromDefault = today;
  const toDefault = addDaysISO(today, 13); // 14 dager inkl. i dag

  const url = new URL(req.url);
  const fromQ = url.searchParams.get("from");
  const toQ = url.searchParams.get("to");
  const modelQ = (url.searchParams.get("model") ?? "v1").trim();

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
      log("forecast:error", { rid, message: error.message, ...meta });

      await logCronRun(admin, {
        job: "forecast",
        status: "error",
        rid,
        detail: error.message,
        meta,
      });

      return jsonErr(500, rid, "rpc_error", "lp_generate_forecast_range feilet", {
        message: error.message,
        code: (error as any)?.code ?? null,
        hint: (error as any)?.hint ?? null,
        details: (error as any)?.details ?? null,
        ...meta,
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

    return json({ ok: true, rid, ...meta, upserts }, 200);
  } catch (e: any) {
    const msg = String(e?.message ?? e);

    // best effort: try logCronRun (needs admin)
    try {
      const admin = await getAdminClient();
      await logCronRun(admin, { job: "forecast", status: "error", rid, detail: msg, meta });
    } catch {}

    return jsonErr(500, rid, "server_error", "Forecast cron feilet", { message: msg, ...meta });
  }
}
