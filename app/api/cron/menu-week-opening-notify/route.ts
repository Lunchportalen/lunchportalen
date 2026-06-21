export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/http/cronAuth";
import { captureCronHandlerError } from "@/lib/http/cronObservability";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  detectMenuWeekOpeningNotifyAnomalies,
  reportMenuWeekOpeningNotifyAnomalies,
} from "@/lib/http/weekCronObservability";
import { shouldRunMenuWeekOpeningNotify } from "@/lib/notifications/menuWeekOpeningCore";
import { runMenuWeekOpeningEmailNotify } from "@/lib/notifications/menuWeekOpeningNotify";

export async function GET(req: Request) {
  const rid = makeRid("cron_mwo");

  try {
    requireCronAuth(req);
  } catch (e: unknown) {
    const msg = String((e as { message?: string })?.message ?? e);
    const code = String((e as { code?: string })?.code ?? "").trim();
    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i env", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret.", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate.", 500, { code: "server_error", detail: { message: msg } });
  }

  const now = new Date();
  if (!shouldRunMenuWeekOpeningNotify(now)) {
    return jsonOk(rid, {
      ok: true,
      skipped: true,
      reason: "outside_window",
      rid,
    });
  }

  try {
    const result = await runMenuWeekOpeningEmailNotify(now);
    const anomalies = detectMenuWeekOpeningNotifyAnomalies(result, { onOpeningDay: true });
    if (anomalies.length > 0) {
      reportMenuWeekOpeningNotifyAnomalies("/api/cron/menu-week-opening-notify", rid, result, anomalies);
    }
    return jsonOk(rid, {
      rid,
      ...result,
      observabilityAlerts: anomalies.map((a) => a.kind),
    });
  } catch (e: unknown) {
    captureCronHandlerError("/api/cron/menu-week-opening-notify", rid, e);
    return jsonErr(rid, "Uke-åpning-varsel feilet.", 500, {
      code: "MENU_WEEK_OPENING_NOTIFY_FAILED",
      detail: { message: String((e as { message?: string })?.message ?? e) },
    });
  }
}
