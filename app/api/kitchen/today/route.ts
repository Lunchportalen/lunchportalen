// app/api/kitchen/today/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";

function noStore() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

export async function GET(req: Request) {
  const today = osloTodayISODate();

  // Bygg absolutt URL basert på request (stabilt i prod)
  const u = new URL(req.url);
  u.pathname = "/api/kitchen/day";
  u.search = `?date=${encodeURIComponent(today)}`;

  return NextResponse.redirect(u.toString(), {
    status: 307, // bevarer GET
    headers: noStore(),
  });
}
