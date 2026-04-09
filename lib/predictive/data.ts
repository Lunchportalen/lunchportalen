/**
 * Ordbasert innsamling for prognose (deler mønster med Control Tower).
 */

import "server-only";

import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { AI_SOCIAL_ATTRIBUTION_SOURCE } from "@/lib/revenue/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

import type {
  PredictiveCollected,
  PredictiveDailyPoint,
  PredictivePostRollup,
  PredictiveProductRollup,
} from "@/lib/predictive/types";

export const PREDICTIVE_LOOKBACK_DAYS = 14;
const MAX_PAGES = 4;
const PAGE_SIZE = 1000;

type OrderRow = { line_total?: unknown; attribution?: unknown; date?: string; status?: string };

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isAiAttributed(attr: unknown): boolean {
  if (!attr || typeof attr !== "object" || Array.isArray(attr)) return false;
  return String((attr as Record<string, unknown>).source ?? "").trim() === AI_SOCIAL_ATTRIBUTION_SOURCE;
}

async function fetchOrdersRange(
  start: string,
  end: string,
): Promise<{ rows: OrderRow[]; truncated: boolean; ok: boolean }> {
  const rows: OrderRow[] = [];
  try {
    const admin = supabaseAdmin();
    for (let page = 0; page < MAX_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await admin
        .from("orders")
        .select("line_total, attribution, date, status")
        .gte("date", start)
        .lte("date", end)
        .eq("status", "ACTIVE")
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { rows, truncated: true, ok: false };
      const chunk = Array.isArray(data) ? (data as OrderRow[]) : [];
      rows.push(...chunk);
      if (chunk.length < PAGE_SIZE) return { rows, truncated: false, ok: true };
    }
    return { rows, truncated: true, ok: true };
  } catch {
    return { rows, truncated: true, ok: false };
  }
}

function buildDailySeries(rows: OrderRow[], start: string, end: string): PredictiveDailyPoint[] {
  const acc = new Map<string, { total: number; aiAttributed: number; orderCount: number; aiOrderCount: number }>();
  for (const r of rows) {
    const d = String(r.date ?? "").trim();
    if (!d) continue;
    const lt = num(r.line_total);
    const cur = acc.get(d) ?? { total: 0, aiAttributed: 0, orderCount: 0, aiOrderCount: 0 };
    cur.total += lt;
    cur.orderCount += 1;
    if (isAiAttributed(r.attribution)) {
      cur.aiAttributed += lt;
      cur.aiOrderCount += 1;
    }
    acc.set(d, cur);
  }

  const out: PredictiveDailyPoint[] = [];
  let cursor = start;
  while (cursor <= end) {
    const v = acc.get(cursor) ?? { total: 0, aiAttributed: 0, orderCount: 0, aiOrderCount: 0 };
    out.push({
      date: cursor,
      total: v.total,
      aiAttributed: v.aiAttributed,
      orderCount: v.orderCount,
      aiOrderCount: v.aiOrderCount,
    });
    if (cursor === end) break;
    cursor = addDaysISO(cursor, 1);
  }
  return out;
}

function topProducts(rows: OrderRow[], limit: number): PredictiveProductRollup[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!isAiAttributed(r.attribution)) continue;
    const attr = r.attribution as Record<string, unknown>;
    const id = String(attr.productId ?? "").trim();
    if (!id) continue;
    m.set(id, (m.get(id) ?? 0) + num(r.line_total));
  }
  return [...m.entries()]
    .map(([id, revenue]) => ({ id, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function topPosts(rows: OrderRow[], limit: number): PredictivePostRollup[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    if (!isAiAttributed(r.attribution)) continue;
    const attr = r.attribution as Record<string, unknown>;
    const id = String(attr.postId ?? "").trim();
    if (!id) continue;
    m.set(id, (m.get(id) ?? 0) + num(r.line_total));
  }
  return [...m.entries()]
    .map(([id, revenue]) => ({ id, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Samler daglige serier og AI-attributterte topp-poster/produkter (siste PREDICTIVE_LOOKBACK_DAYS).
 */
export async function collectPredictiveData(): Promise<PredictiveCollected> {
  const today = osloTodayISODate();
  const start = addDaysISO(today, -(PREDICTIVE_LOOKBACK_DAYS - 1));
  const collectedAt = new Date().toISOString();

  const { rows, truncated, ok } = await fetchOrdersRange(start, today);
  if (!ok) {
    return {
      dailyTotals: [],
      revenue: [],
      products: [],
      posts: [],
      timestamps: [],
      collectedAt,
      dataSource: "unavailable",
      seriesTruncated: false,
    };
  }

  const dailyTotals = buildDailySeries(rows, start, today);
  const timestamps = dailyTotals.map((d) => d.date);
  const revenue = dailyTotals.map((d) => d.total);

  return {
    dailyTotals,
    revenue,
    products: topProducts(rows, 8),
    posts: topPosts(rows, 8),
    timestamps,
    collectedAt,
    dataSource: "orders",
    seriesTruncated: truncated,
  };
}

/** Andelspoeng-fall: (eldre 3d andel) − (nyere 3d andel). Positiv = fall. */
export function computeAiOrderShareDropPercent(dailyTotals: PredictiveDailyPoint[], todayIso: string): number | null {
  const sorted = [...dailyTotals].filter((d) => d.date <= todayIso).sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 6) return null;
  const recent = sorted.slice(-3);
  const prior = sorted.slice(-6, -3);
  const share = (days: PredictiveDailyPoint[]): number | null => {
    let o = 0;
    let a = 0;
    for (const d of days) {
      o += d.orderCount;
      a += d.aiOrderCount;
    }
    if (o === 0) return null;
    return (a / o) * 100;
  };
  const sr = share(recent);
  const sp = share(prior);
  if (sr == null || sp == null) return null;
  return Math.round((sp - sr) * 10) / 10;
}
