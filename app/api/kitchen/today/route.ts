// app/api/kitchen/today/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { isIsoDate, osloTodayISODate } from "@/lib/date/oslo";

function noStore() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

/**
 * GET /api/kitchen/today
 * - redirect (read-only) til /api/kitchen/day?date=YYYY-MM-DD
 * - valgfri query: ?date=YYYY-MM-DD
 * - 307 for å bevare GET
 * - no-store headers alltid
 */
export async function GET(req: Request) {
  const url = new URL(req.url);

  // Valgfri date override
  const q = safeStr(url.searchParams.get("date"));
  const date = q && isIsoDate(q) ? q : osloTodayISODate();

  // Bygg absolutt URL basert på request (stabilt i prod)
  const u = new URL(req.url);
  u.pathname = "/api/kitchen/day";
  u.search = `?date=${encodeURIComponent(date)}`;

  return NextResponse.redirect(u.toString(), {
    status: 307, // bevarer GET
    headers: noStore(),
  });
}
