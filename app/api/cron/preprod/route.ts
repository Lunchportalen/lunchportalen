// app/api/cron/preprod/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";

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
  const rid = crypto.randomUUID?.() ?? `preprod_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

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

      return jsonErr(500, rid, "rpc_error", "lp_generate_signals_for_date feilet", {
        message: error.message ?? String(error),
        code: (error as any)?.code ?? null,
        hint: (error as any)?.hint ?? null,
        details: (error as any)?.details ?? null,
        ...meta,
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

    return json({ ok: true, rid, ...meta, signals_upserted: upserted }, 200);
  } catch (e: any) {
    const msg = String(e?.message ?? e);

    // Best effort: try to log
    try {
      const admin = await getAdminClient();
      await logCronRun(admin, { job: "preprod", status: "error", rid, detail: msg, meta });
    } catch {}

    return jsonErr(500, rid, "server_error", "Preprod cron feilet", { message: msg, ...meta });
  }
}
