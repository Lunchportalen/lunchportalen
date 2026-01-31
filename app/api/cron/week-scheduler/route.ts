// app/api/cron/week-scheduler/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

/* =========================================================
   Security (cron secret in query)
========================================================= */
function safeStr(v: any) {
  return String(v ?? "").trim();
}

function requireCronAuth(req: Request) {
  const url = new URL(req.url);
  const got = safeStr(url.searchParams.get("key"));
  const want = safeStr(process.env.CRON_SECRET);
  return Boolean(want && got && got === want);
}

/* =========================================================
   Oslo time helpers (no deps)
========================================================= */
type OsloParts = { weekday: string; hour: number; minute: number; isoDate: string };

function osloNowParts(d = new Date()): OsloParts {
  // weekday/hour/minute in Europe/Oslo
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

  const weekday = get("weekday"); // Thursday, Friday, ...
  const hour = Number(get("hour") || "0");
  const minute = Number(get("minute") || "0");

  // ISO date YYYY-MM-DD (Oslo)
  const y = get("year");
  const m = get("month");
  const day = get("day");
  const isoDate = `${y}-${m}-${day}`;

  return { weekday, hour, minute, isoDate };
}

function inWindow(p: OsloParts, wantWeekday: string, wantHour: number, windowMins = 10) {
  // run every 10 minutes -> trigger once per hour window by minute < 10
  return p.weekday === wantWeekday && p.hour === wantHour && p.minute >= 0 && p.minute < windowMins;
}

/* =========================================================
   Call existing cron routes (avoid duplicate logic)
========================================================= */
async function callInternal(req: Request, path: string) {
  const url = new URL(req.url);
  const base = `${url.protocol}//${url.host}`;
  const key = safeStr(new URL(req.url).searchParams.get("key"));

  const target = `${base}${path}?key=${encodeURIComponent(key)}`;
  const res = await fetch(target, { method: "GET", cache: "no-store" });

  const text = await res.text().catch(() => "");
  return { ok: res.ok, status: res.status, text };
}

export async function GET(req: Request) {
  if (!requireCronAuth(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const p = osloNowParts();
  const triggered: string[] = [];
  const results: any[] = [];

  // Thursday 08:00 -> make next week visible/open (existing endpoint)
  if (inWindow(p, "Thursday", 8, 10)) {
    triggered.push("thursday_08_open_next");
    results.push({ action: "week-visibility", ...(await callInternal(req, "/api/cron/week-visibility")) });
  }

  // Friday 14:00 -> rollover/lock weekplans (existing endpoint)
  if (inWindow(p, "Friday", 14, 10)) {
    triggered.push("friday_14_rollover");
    results.push({ action: "lock-weekplans", ...(await callInternal(req, "/api/cron/lock-weekplans")) });
  }

  // If outside both windows -> no-op (idempotent)
  return NextResponse.json({
    ok: true,
    oslo: p,
    triggered,
    results,
    note: triggered.length ? "Triggered scheduled actions." : "No-op (outside time windows).",
  });
}
