import type { MooLogRow, MooOrderRow, MooRawMetrics, MooSessionRow } from "@/lib/moo/types";

function num(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export type BuildMooMetricsInput = {
  orders: MooOrderRow[];
  sessions: MooSessionRow[];
  logs: MooLogRow[];
};

/**
 * Aggregates real inputs into comparable raw metrics (deterministic).
 */
export function buildMooMetrics(input: BuildMooMetricsInput): MooRawMetrics {
  const orders = Array.isArray(input.orders) ? input.orders : [];
  const sessions = Array.isArray(input.sessions) ? input.sessions : [];
  const logs = Array.isArray(input.logs) ? input.logs : [];

  const revenue = orders.reduce((s, o) => s + num(o?.total_amount), 0);
  const ordersCount = orders.length;

  const sessionsByUser: Record<string, number> = {};
  for (const s of sessions) {
    const key = (typeof s?.user_id === "string" && s.user_id.trim()
      ? s.user_id.trim()
      : typeof s?.session_id === "string" && s.session_id.trim()
        ? s.session_id.trim()
        : ""
    ).trim();
    if (!key) continue;
    sessionsByUser[key] = (sessionsByUser[key] ?? 0) + 1;
  }

  const users = Object.keys(sessionsByUser).length;
  const returningUsers = Object.values(sessionsByUser).filter((v) => v > 1).length;
  const retention = users > 0 ? returningUsers / users : 0;

  const dwellEvents = logs.filter((l) => String(l?.action ?? "").trim() === "page_view");
  const dwellSum = dwellEvents.reduce((a, l) => a + num(l?.metadata?.duration), 0);
  const dwellTime = dwellSum / Math.max(dwellEvents.length, 1);

  return {
    revenue,
    orders: ordersCount,
    retention,
    dwellTime,
  };
}
