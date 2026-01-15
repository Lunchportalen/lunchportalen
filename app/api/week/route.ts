import { NextResponse } from "next/server";
import { getMenuForRange } from "@/lib/sanity/queries";

function toISODateOslo(d: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Monday=0 .. Sunday=6 (Oslo)
function osloWeekdayIndex(date: Date) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Oslo",
    weekday: "short",
  }).format(date);

  const map: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  return map[weekday] ?? 0;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const weekOffset = Math.max(0, Math.min(1, Number(url.searchParams.get("weekOffset") || "0"))); // maks 0/1

    const now = new Date();
    const idx = osloWeekdayIndex(now);
    const monday = addDays(now, -idx + (weekOffset * 7));
    const friday = addDays(monday, 4);

    const fromISO = toISODateOslo(monday);
    const toISO = toISODateOslo(friday);

    const items = await getMenuForRange(fromISO, toISO);

    // Map for rask lookup
    const byDate = new Map<string, any>();
    for (const it of items || []) byDate.set(it.date, it);

    // Returner alltid 5 dager (man–fre)
    const days = Array.from({ length: 5 }).map((_, i) => {
      const d = addDays(monday, i);
      const date = toISODateOslo(d);
      const it = byDate.get(date);

      return {
        date,
        weekday: ["Man", "Tir", "Ons", "Tor", "Fre"][i],
        isPublished: !!it?.isPublished,
        description: it?.description ?? null,
        allergens: it?.allergens ?? [],
      };
    });

    return NextResponse.json({
      ok: true,
      range: { from: fromISO, to: toISO },
      weekOffset,
      days,
    });
  } catch (err: any) {
    console.error("[GET /api/week]", err?.message || err, err);
    return NextResponse.json(
      { ok: false, error: "SERVER_ERROR", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
