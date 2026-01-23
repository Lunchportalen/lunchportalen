export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { fetchNextPublishedWeekPlan } from "@/lib/sanity/weekplan";

const OSLO_TZ = "Europe/Oslo";

function todayOsloISODate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: OSLO_TZ }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`; // ISO YYYY-MM-DD
}

export async function GET() {
  const today = todayOsloISODate();

  const plan = await fetchNextPublishedWeekPlan(today);

  // Returnerer ISO i API – UI formatterer til DD-MM-YYYY
  return NextResponse.json({ ok: true, today, plan }, { status: 200 });
}
