// /app/api/week/route.ts
import { NextResponse } from "next/server";
import { getMenuForRange } from "@/lib/sanity/queries";
import { addDaysISO, osloNowParts, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";

export const revalidate = 30;

const WEEKDAYS_NO = ["Man", "Tir", "Ons", "Tor", "Fre"] as const;

function clampWeekOffset(v: number): 0 | 1 {
  return (Math.max(0, Math.min(1, v)) as 0 | 1) ?? 0;
}

/**
 * 🔒 Uke 2 unlock: torsdag i uke 1 kl 08:00 (Oslo)
 * week0MondayISO = mandag i inneværende uke (uke 0)
 * unlockAt = (week0MondayISO + 3 dager) kl 08:00
 */
function week2UnlockFromWeek0Monday(week0MondayISO: string) {
  const unlockDateISO = addDaysISO(week0MondayISO, 3); // Thursday
  const unlockTimeHM = "08:00";
  return {
    unlockDateISO,
    unlockTimeHM,
    unlockAt: `${unlockDateISO}T08:00`,
  };
}

function isUnlocked(unlockDateISO: string, unlockTimeHM: string) {
  const now = osloNowParts();
  const nowDateISO = `${now.yyyy}-${now.mm}-${now.dd}`;
  const nowTimeHM = `${String(now.hh).padStart(2, "0")}:${String(now.mi).padStart(2, "0")}`;

  if (nowDateISO < unlockDateISO) return false;
  if (nowDateISO > unlockDateISO) return true;
  return nowTimeHM >= unlockTimeHM;
}

export async function GET(req: Request) {
  const rid = `week_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const url = new URL(req.url);
    const weekOffset = clampWeekOffset(Number(url.searchParams.get("weekOffset") || "0"));

    // ✅ Finn mandag for uke 0 (inneværende uke) i Oslo
    const todayISO = osloTodayISODate();
    const week0MondayISO = startOfWeekISO(todayISO);

    // ✅ Beregn mandag/fredag for ønsket uke (0 eller 1)
    const mondayISO = addDaysISO(week0MondayISO, weekOffset * 7);
    const fridayISO = addDaysISO(mondayISO, 4);

    // 🔒 Lås ukeOffset=1 frem til torsdag 08:00 i uke 0
    const { unlockDateISO, unlockTimeHM, unlockAt } = week2UnlockFromWeek0Monday(week0MondayISO);
    const locked = weekOffset === 1 ? !isUnlocked(unlockDateISO, unlockTimeHM) : false;

    // Returner alltid 5 dager (man–fre), men ikke lek innhold før unlock
    if (locked) {
      const days = Array.from({ length: 5 }).map((_, i) => {
        const date = addDaysISO(mondayISO, i);
        return {
          date,
          weekday: WEEKDAYS_NO[i],
          isPublished: false,
          description: null,
          allergens: [],
        };
      });

      return NextResponse.json({
        ok: true,
        rid,
        range: { from: mondayISO, to: fridayISO },
        weekOffset,
        locked: true,
        unlockAt,
        days,
      });
    }

    // ✅ Hent innhold når ikke låst
    // getMenuForRange er nå "kundesynlig range":
    // approvedForPublish==true + customerVisible==true + published
    const items = await getMenuForRange(mondayISO, fridayISO);

    // Map for rask lookup
    const byDate = new Map<string, any>();
    for (const it of items || []) byDate.set(it.date, it);

    const days = Array.from({ length: 5 }).map((_, i) => {
      const date = addDaysISO(mondayISO, i);
      const it = byDate.get(date);

      return {
        date,
        weekday: WEEKDAYS_NO[i],
        isPublished: !!it?.isPublished,
        description: it?.description ?? null,
        allergens: it?.allergens ?? [],
      };
    });

    return NextResponse.json({
      ok: true,
      rid,
      range: { from: mondayISO, to: fridayISO },
      weekOffset,
      locked: false,
      unlockAt,
      days,
    });
  } catch (err: any) {
    console.error("[GET /api/week]", err?.message || err, err);
    return NextResponse.json(
      { ok: false, rid, error: "SERVER_ERROR", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
