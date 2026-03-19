// app/api/cron/outbox/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/http/cronAuth";
import { makeRid, jsonErr, jsonOk } from "@/lib/http/respond";
import { processOutboxBatch } from "@/lib/orderBackup/outbox";
import { supabaseAdmin } from "@/lib/supabase/admin";

function clampInt(v: unknown, min: number, max: number, fallback: number) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}

async function logCronRun(
  payload: { job: "outbox"; status: "ok" | "error"; rid: string; detail?: string | null; meta?: Record<string, any> }
) {
  try {
    const admin: any = supabaseAdmin();
    await admin.from("cron_runs").insert({
      job: payload.job,
      status: payload.status,
      rid: payload.rid,
      detail: payload.detail ?? null,
      meta: payload.meta ?? {},
    });
  } catch {
    // Observability-only; never block cron on cron_runs failure.
  }
}

export async function POST(req: NextRequest) {
  const rid = makeRid();

  try {
    requireCronAuth(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();

    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET er ikke satt i environment.", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig eller manglende cron secret.", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate.", 500, { code: "server_error", detail: { message: msg } });
  }

  try {
    const batchSize = clampInt(process.env.OUTBOX_BATCH_SIZE, 1, 200, 25);
    const timeBudgetMs = clampInt(process.env.OUTBOX_TIME_BUDGET_MS, 500, 60000, 20000);
    const staleMinutes = clampInt(process.env.OUTBOX_STALE_MINUTES, 1, 120, 10);

    const result = await processOutboxBatch(batchSize, {
      rid,
      worker: `cron-outbox:${rid}`,
      staleMinutes,
      timeBudgetMs,
    });

    void logCronRun({
      job: "outbox",
      status: "ok",
      rid,
      meta: {
        batchSize,
        timeBudgetMs,
        staleMinutes,
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
        failedPermanent: result.failedPermanent,
        timedOut: result.timedOut,
        resetStale: result.resetStale,
        maxAttempts: result.maxAttempts,
      },
    });

    return jsonOk(
      rid,
      {
        batchSize,
        timeBudgetMs,
        staleMinutes,
        processed: result.processed,
        sent: result.sent,
        failed: result.failed,
        failedPermanent: result.failedPermanent,
        timedOut: result.timedOut,
        resetStale: result.resetStale,
        maxAttempts: result.maxAttempts,
      },
      200
    );
  } catch (e: any) {
    const message = String(e?.message ?? e);

    void logCronRun({
      job: "outbox",
      status: "error",
      rid,
      detail: message,
    });

    return jsonErr(rid, "Outbox processing feilet.", 500, {
      code: "outbox_failed",
      detail: { message },
    });
  }
}
