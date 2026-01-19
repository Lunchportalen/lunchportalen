// app/api/kitchen/today/route.ts
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { osloTodayISODate } from "@/lib/date/oslo";

export async function GET() {
  const today = osloTodayISODate();

  // 🔁 today er kun en tynn wrapper rundt day
  const url = `/api/kitchen/day?date=${today}`;

  return NextResponse.redirect(url, {
    status: 307, // bevarer GET
  });
}
