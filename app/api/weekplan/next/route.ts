// app/api/weekplan/next/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

/* =========================================================
   Oslo time helpers (single source of truth)
========================================================= */
const OSLO_TZ = "Europe/Oslo";

function todayOsloISODate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: OSLO_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";

  return `${y}-${m}-${d}`; // YYYY-MM-DD
}

/* =========================================================
   GET /api/weekplan/next — DEPRECATED
   Bruk GET /api/week?weekOffset=1 (menuContent + avtale).
========================================================= */
export async function GET() {
  const rid = makeRid();

  try {
    const today = todayOsloISODate();

    return jsonOk(
      rid,
      {
        ok: true,
        today,
        plan: null,
        deprecated: true,
        successor: "/api/week?weekOffset=1",
        message: "Sanity weekPlan er ikke lenger operativ employee-kilde.",
      },
      200,
      {
        Deprecation: "true",
        Link: '</api/week?weekOffset=1>; rel="successor-version"',
      }
    );
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke hente neste uke.", 500, { code: "WEEKPLAN_NEXT_FAILED", detail: {
      message: String(e?.message ?? e),
    } });
  }
}

