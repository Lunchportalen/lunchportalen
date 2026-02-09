// app/api/system/time/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { NextResponse } from "next/server";
import { makeRid } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import {
  osloNowISO,
  osloNowParts,
  osloTodayISODate,
  osloTodayNODate,
  isAfterCutoff0800,
  isAfterCutoff0805,
} from "@/lib/date/oslo";

function applyNoStore(res: NextResponse) {
  const h = noStoreHeaders() as Record<string, string>;
  for (const [k, v] of Object.entries(h)) res.headers.set(k, v);
  res.headers.set("content-type", "application/json; charset=utf-8");
  res.headers.set("x-content-type-options", "nosniff");
  return res;
}

function ok(rid: string, data: unknown, status = 200) {
  return applyNoStore(
    NextResponse.json(
      { ok: true, rid, data },
      { status }
    )
  );
}

function err(rid: string, message: string, status: number, code: string) {
  return applyNoStore(
    NextResponse.json(
      { ok: false, rid, error: code, message, status },
      { status }
    )
  );
}

function ensureDdMmYyyy(s: string) {
  // Accept only dd-mm-yyyy. If helper returns something else, convert from ISO date.
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;

  // Try ISO "yyyy-mm-dd"
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split("-");
    return `${d}-${m}-${y}`;
  }

  return s; // fallback (should not happen)
}

export async function GET() {
  const rid = makeRid();

  try {
    const parts = osloNowParts();

    const todayISO = osloTodayISODate(); // yyyy-mm-dd
    const todayNO = ensureDdMmYyyy(osloTodayNODate() || ""); // dd-mm-yyyy (forced)

    return ok(rid, {
      nowISO: osloNowISO(),        // 2026-02-08T23:04:03
      todayISO,                    // 2026-02-08
      todayNO: todayNO || ensureDdMmYyyy(todayISO), // 08-02-2026
      weekday: parts.weekday,      // Sun / Mon / ...
      time: {
        hh: parts.hh,
        mi: parts.mi,
        ss: parts.ss,
      },
      cutoff: {
        after0800: isAfterCutoff0800(),
        after0805: isAfterCutoff0805(),
      },
      timezone: "Europe/Oslo",
    });
  } catch (e: any) {
    return err(rid, "Kunne ikke hente tid akkurat nå.", 500, "server_error");
  }
}
