// app/api/cron/week-scheduler/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

type OsloParts = { weekday: string; hour: number; minute: number; isoDate: string };

function osloNowParts(d = new Date()): OsloParts {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Oslo",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour12: false,
  });

  const parts = dtf.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";

  const weekday = get("weekday");
  const hour = Number(get("hour") || "0");
  const minute = Number(get("minute") || "0");

  const y = get("year");
  const m = get("month");
  const day = get("day");
  const isoDate = `${y}-${m}-${day}`;

  return { weekday, hour, minute, isoDate };
}

function inWindow(p: OsloParts, wantWeekday: string, wantHour: number, windowMins = 10) {
  return p.weekday === wantWeekday && p.hour === wantHour && p.minute >= 0 && p.minute < windowMins;
}

async function callInternal(req: Request, path: string) {
  const baseUrl = safeStr(process.env.PUBLIC_APP_URL) || (() => {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  })();

  const secret = safeStr(process.env.CRON_SECRET);
  const headers: Record<string, string> = {};
  if (secret) headers.authorization = `Bearer ${secret}`;

  const target = `${baseUrl}${path}`;
  const res = await fetch(target, { method: "GET", cache: "no-store", headers });

  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
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
      return jsonErr(rid, "Ugyldig cron secret.", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate.", 500, { code: "server_error", detail: { message: msg } });
  }

  try {
    const p = osloNowParts();
    const triggered: string[] = [];
    const results: any[] = [];

    if (inWindow(p, "Thursday", 8, 10)) {
      triggered.push("thursday_08_open_next");
      results.push({ action: "week-visibility", ...(await callInternal(req, "/api/cron/week-visibility")) });
    }

    if (inWindow(p, "Friday", 14, 10)) {
      triggered.push("friday_14_rollover");
      results.push({ action: "lock-weekplans", ...(await callInternal(req, "/api/cron/lock-weekplans")) });
    }

    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        oslo: p,
        triggered,
        results,
        note: triggered.length ? "Triggered scheduled actions." : "No-op (outside time windows).",
      },
      200
    );
  } catch (e: any) {
    return jsonErr(rid, "Uventet feil i week-scheduler.", 500, {
      code: "WEEK_SCHEDULER_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
