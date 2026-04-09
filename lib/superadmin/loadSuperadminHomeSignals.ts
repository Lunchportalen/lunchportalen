import "server-only";

import { osloTodayISODate } from "@/lib/date/oslo";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type SuperadminHomeSignalsOk = {
  companies: { active: number; pending: number; paused: number; closed: number; total: number };
  orders: { today: number; tomorrow: number; week: number };
  alerts: { pendingCompanies: number; pausedCompanies: number };
  /** Antall avtaler med status PENDING (godkjenningskø). */
  pendingAgreements: number;
};

export type LoadSuperadminHomeSignalsResult = { ok: true; data: SuperadminHomeSignalsOk } | { ok: false; reason: string };

function asInt(n: unknown) {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function startOfWeekISO(iso: string) {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay();
  const diffToMon = (day + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - diffToMon);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Lesende aggregater for /superadmin-hjem (samme talllogikk som GET /api/superadmin/dashboard + PENDING-avtaler).
 * Kall kun etter superadmin-gate på siden.
 */
export async function loadSuperadminHomeSignals(): Promise<LoadSuperadminHomeSignalsResult> {
  try {
    const sb = supabaseAdmin();
    const today = osloTodayISODate();
    const tomorrow = addDaysISO(today, 1);
    const weekStart = startOfWeekISO(today);
    const weekEndExclusive = addDaysISO(weekStart, 7);

    const { data: companyRows, error: cErr } = await sb.from("companies").select("status");
    if (cErr) return { ok: false, reason: cErr.message };

    const counts = { active: 0, pending: 0, paused: 0, closed: 0, total: 0 };
    for (const r of companyRows ?? []) {
      counts.total++;
      const st = String((r as { status?: string }).status ?? "").toLowerCase();
      if (st === "active") counts.active++;
      else if (st === "pending") counts.pending++;
      else if (st === "paused") counts.paused++;
      else if (st === "closed") counts.closed++;
    }

    const [
      { count: todayCount, error: o1Err },
      { count: tomorrowCount, error: o2Err },
      { count: weekCount, error: o3Err },
      { count: pendingAgreements, error: aErr },
    ] = await Promise.all([
      sb.from("orders").select("id", { count: "exact", head: true }).eq("date", today),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("date", tomorrow),
      sb.from("orders").select("id", { count: "exact", head: true }).gte("date", weekStart).lt("date", weekEndExclusive),
      sb.from("agreements").select("id", { count: "exact", head: true }).eq("status", "PENDING"),
    ]);

    if (o1Err) return { ok: false, reason: o1Err.message };
    if (o2Err) return { ok: false, reason: o2Err.message };
    if (o3Err) return { ok: false, reason: o3Err.message };
    if (aErr) return { ok: false, reason: aErr.message };

    const data: SuperadminHomeSignalsOk = {
      companies: { ...counts },
      orders: { today: asInt(todayCount), tomorrow: asInt(tomorrowCount), week: asInt(weekCount) },
      alerts: { pendingCompanies: counts.pending, pausedCompanies: counts.paused },
      pendingAgreements: asInt(pendingAgreements),
    };

    return { ok: true, data };
  } catch (e: unknown) {
    return { ok: false, reason: String(e instanceof Error ? e.message : e) };
  }
}
