// app/api/weekplan/next/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";

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
   GET /api/weekplan/next
   - Returnerer neste uke KUN når status === "open"
   - UI viser ikke "Neste uke" før torsdag 08:00
========================================================= */
export async function GET() {
  
  const { fetchNextOpenWeekPlan } = await import("@/lib/sanity/weekplan");
  const today = todayOsloISODate();

  // Henter KUN weekPlan med status "open"
  // (systemet åpner denne torsdag 08:00)
  const plan = await fetchNextOpenWeekPlan(today);

  if (!plan) {
    // Ingen åpen neste uke ennå → helt forventet før torsdag 08:00
    return NextResponse.json(
      { ok: true, today, plan: null },
      { status: 200 }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      today,
      plan,
    },
    { status: 200 }
  );
}


