/**
 * Control Tower — aggregerer eksisterende kilder (best-effort, fail-closed per del).
 */

import "server-only";

import { unstable_cache } from "next/cache";

import { financialAlertInputFromControlTower } from "@/lib/alerts/controlTowerBridge";
import { dispatchFinancialAlerts } from "@/lib/alerts/dispatcher";
import { runAlertChecks } from "@/lib/alerts/engine";
import { addDaysISO, osloNowParts, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { AI_SOCIAL_ATTRIBUTION_SOURCE } from "@/lib/revenue/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSystemHealth } from "@/lib/system/systemHealthAggregator";

import { collectPredictiveData, computeAiOrderShareDropPercent, PREDICTIVE_LOOKBACK_DAYS } from "@/lib/predictive/data";
import { detectAnomalies } from "@/lib/predictive/anomalies";
import { recommendActions } from "@/lib/predictive/actions";
import { forecastRevenue } from "@/lib/predictive/forecast";
import { detectTrend } from "@/lib/predictive/trends";

import { getControlTowerAuditSnapshot } from "@/lib/audit/query";
import { calculatePL } from "@/lib/finance/pl";
import type { ControlTowerData, ControlTowerHealthLevel } from "@/lib/controlTower/types";

const CACHE_TAG = "control-tower-v1";

/** Brukes av API ved manuell oppfrisking (`revalidateTag`). */
export const CONTROL_TOWER_CACHE_TAG = CACHE_TAG;
const REVALIDATE_SEC = 45;
const MAX_ORDER_PAGES = 5;
const PAGE_SIZE = 1000;
const AI_LOG_LIMIT = 400;
const HOURS_24_MS = 24 * 60 * 60 * 1000;

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapHealth(s: "ok" | "degraded" | "critical"): ControlTowerHealthLevel {
  if (s === "critical") return "critical";
  if (s === "degraded") return "warning";
  return "ok";
}

type OrderRow = { line_total?: unknown; attribution?: unknown; date?: string; status?: string };

function rollupAttributed(rows: OrderRow[]): {
  total: number;
  aiTotal: number;
  topPost: { id: string; revenue: number } | null;
  topProduct: { id: string; revenue: number } | null;
} {
  let total = 0;
  let aiTotal = 0;
  const postMap = new Map<string, number>();
  const prodMap = new Map<string, number>();

  for (const r of rows) {
    const lt = num(r.line_total);
    total += lt;
    const attr = r.attribution;
    if (!attr || typeof attr !== "object" || Array.isArray(attr)) continue;
    const a = attr as Record<string, unknown>;
    if (String(a.source ?? "").trim() !== AI_SOCIAL_ATTRIBUTION_SOURCE) continue;
    aiTotal += lt;
    const postId = String(a.postId ?? "").trim();
    if (postId) postMap.set(postId, (postMap.get(postId) ?? 0) + lt);
    const productId = String(a.productId ?? "").trim();
    if (productId) prodMap.set(productId, (prodMap.get(productId) ?? 0) + lt);
  }

  let topPost: { id: string; revenue: number } | null = null;
  for (const [id, revenue] of postMap) {
    if (!topPost || revenue > topPost.revenue) topPost = { id, revenue };
  }
  let topProduct: { id: string; revenue: number } | null = null;
  for (const [id, revenue] of prodMap) {
    if (!topProduct || revenue > topProduct.revenue) topProduct = { id, revenue };
  }

  return { total, aiTotal, topPost, topProduct };
}

async function fetchOrdersToday(today: string): Promise<{ rows: OrderRow[]; ok: boolean }> {
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("orders")
      .select("line_total, attribution, date, status")
      .eq("date", today)
      .eq("status", "ACTIVE")
      .limit(20000);
    if (error) return { rows: [], ok: false };
    return { rows: Array.isArray(data) ? (data as OrderRow[]) : [], ok: true };
  } catch {
    return { rows: [], ok: false };
  }
}

async function fetchOrdersWeek(weekStart: string, weekEnd: string): Promise<{ rows: OrderRow[]; truncated: boolean; ok: boolean }> {
  const rows: OrderRow[] = [];
  try {
    const admin = supabaseAdmin();
    for (let page = 0; page < MAX_ORDER_PAGES; page++) {
      const from = page * PAGE_SIZE;
      const { data, error } = await admin
        .from("orders")
        .select("line_total, attribution, date, status")
        .gte("date", weekStart)
        .lte("date", weekEnd)
        .eq("status", "ACTIVE")
        .range(from, from + PAGE_SIZE - 1);
      if (error) return { rows, truncated: true, ok: false };
      const chunk = Array.isArray(data) ? (data as OrderRow[]) : [];
      rows.push(...chunk);
      if (chunk.length < PAGE_SIZE) {
        return { rows, truncated: false, ok: true };
      }
    }
    return { rows, truncated: true, ok: true };
  } catch {
    return { rows, truncated: true, ok: false };
  }
}

function parseMetadataColumn(raw: unknown): Record<string, unknown> | null {
  if (raw != null && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string" && raw.trim()) {
    try {
      const o = JSON.parse(raw) as unknown;
      if (o != null && typeof o === "object" && !Array.isArray(o)) return o as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  return null;
}

function toolFromMetadata(meta: unknown): string {
  const m = parseMetadataColumn(meta);
  if (!m) return "";
  const t = m.tool;
  return typeof t === "string" ? t.trim() : "";
}

function resultStatusFromMetadata(meta: unknown): string {
  const m = parseMetadataColumn(meta);
  if (!m) return "";
  const rs = m.resultStatus;
  return typeof rs === "string" ? rs.trim().toLowerCase() : "";
}

async function fetchAiSocialMetrics(sinceIso: string): Promise<{
  decisions24h: number;
  approved24h: number;
  skipped24h: number;
  lowConfidence24h: number;
  lastCycleAt: string | null;
  failures24h: number;
  ok: boolean;
}> {
  const empty = {
    decisions24h: 0,
    approved24h: 0,
    skipped24h: 0,
    lowConfidence24h: 0,
    lastCycleAt: null as string | null,
    failures24h: 0,
    ok: false,
  };
  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("ai_activity_log")
      .select("metadata, created_at, action")
      .eq("action", "suggest")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(AI_LOG_LIMIT);

    if (error) return empty;

    const rows = Array.isArray(data) ? data : [];
    let decisions24h = 0;
    let approved24h = 0;
    let skipped24h = 0;
    let lowConfidence24h = 0;
    let failures24h = 0;
    let lastCycleAt: string | null = null;

    for (const row of rows) {
      const rawMeta = (row as { metadata?: unknown }).metadata;
      const meta = parseMetadataColumn(rawMeta);
      const tool = toolFromMetadata(meta);
      const isDecision = tool === "social_engine_autonomy_decision";
      const isCycle = tool === "social_engine_autonomy_cycle";
      if (!isDecision && !isCycle) continue;

      const st = resultStatusFromMetadata(meta);
      if (st === "failure") failures24h += 1;

      if (isCycle) {
        const ev = meta?.event;
        if (ev === "cycle_complete" || ev === "cycle_skipped_paused") {
          const ca = (row as { created_at?: string }).created_at;
          if (typeof ca === "string" && ca && (!lastCycleAt || ca > lastCycleAt)) lastCycleAt = ca;
        }
        continue;
      }

      decisions24h += 1;
      const phase = meta?.phase;
      const decision = meta?.decision as Record<string, unknown> | undefined;
      const skipReason = typeof decision?.skipReason === "string" ? decision.skipReason : "";

      if (phase === "executed") approved24h += 1;
      else if (phase === "skipped") {
        skipped24h += 1;
        if (skipReason === "low_confidence") lowConfidence24h += 1;
      }
    }

    return {
      decisions24h,
      approved24h,
      skipped24h,
      lowConfidence24h,
      lastCycleAt,
      failures24h,
      ok: true,
    };
  } catch {
    return empty;
  }
}

async function loadControlTowerDataUncached(): Promise<ControlTowerData> {
  const generatedAt = new Date().toISOString();
  const today = osloTodayISODate();
  const weekStart = startOfWeekISO(today);
  const weekEnd = addDaysISO(weekStart, 6);
  const yesterday = addDaysISO(today, -1);
  const sinceIso = new Date(Date.now() - HOURS_24_MS).toISOString();

  const [todayRes, yesterdayRes, weekRes, aiRes, healthRes, predictiveCollected, auditSnap] = await Promise.all([
    fetchOrdersToday(today),
    fetchOrdersToday(yesterday),
    fetchOrdersWeek(weekStart, weekEnd),
    fetchAiSocialMetrics(sinceIso),
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- aggregator matcher smalt AdminClient-API
        return await getSystemHealth(supabaseAdmin() as any);
      } catch {
        return null;
      }
    })(),
    collectPredictiveData(),
    getControlTowerAuditSnapshot(),
  ]);

  const todayRoll = todayRes.ok ? rollupAttributed(todayRes.rows) : { total: 0, aiTotal: 0, topPost: null, topProduct: null };
  const yesterdayRoll = yesterdayRes.ok
    ? rollupAttributed(yesterdayRes.rows)
    : { total: 0, aiTotal: 0, topPost: null, topProduct: null };
  const weekRoll = weekRes.ok ? rollupAttributed(weekRes.rows) : { total: 0, aiTotal: 0, topPost: null, topProduct: null };

  const weekOrderCount = weekRes.rows.length;
  const aiShare =
    weekOrderCount > 0
      ? weekRes.rows.filter((r) => {
          const attr = r.attribution;
          if (!attr || typeof attr !== "object" || Array.isArray(attr)) return false;
          return String((attr as Record<string, unknown>).source ?? "").trim() === AI_SOCIAL_ATTRIBUTION_SOURCE;
        }).length / weekOrderCount
      : null;

  const healthLevel: ControlTowerHealthLevel = healthRes ? mapHealth(healthRes.status) : "warning";
  const healthSummary = healthRes
    ? `${healthRes.status}: db ${healthRes.database}; utboks ${healthRes.outbox}`
    : "Kunne ikke lese systemhelse.";

  const revenueOk = todayRes.ok && weekRes.ok;
  const alertsDataTrusted = todayRes.ok && weekRes.ok && yesterdayRes.ok;

  const fc = forecastRevenue(predictiveCollected.dailyTotals, today);
  const trend = detectTrend(predictiveCollected.dailyTotals, today);
  const conversionDropPercent = computeAiOrderShareDropPercent(predictiveCollected.dailyTotals, today);
  const anomalies = detectAnomalies({
    revenueToday: todayRoll.total,
    conversionDropPercent,
    weekTruncated: weekRes.truncated,
    seriesTruncated: predictiveCollected.seriesTruncated,
    dataSource: revenueOk ? "orders" : "unavailable",
    systemHealth: healthLevel,
  });
  const recommendedActions = recommendActions({
    trend,
    bestProductId: weekRoll.topProduct?.id ?? predictiveCollected.products[0]?.id ?? null,
    lowConversion: conversionDropPercent != null && conversionDropPercent > 15,
    forecastSufficient: fc.sufficientData,
    anomaliesNonEmpty: anomalies.length > 0,
  });

  const predictiveDataAvailable =
    predictiveCollected.dataSource === "orders" && predictiveCollected.dailyTotals.length > 0;

  const weekRevenueForPl = weekRoll.total;
  const financeInputs = {
    revenue: weekRevenueForPl,
    costOfGoods: 0,
    adSpend: 0,
  };
  const plWeek = calculatePL(financeInputs);

  const financeBlock = {
    pl: plWeek,
    inputs: financeInputs,
    cogsKnown: false,
    adSpendKnown: false,
    explainNb: [
      "Varekost er ikke beregnet i kontrolltårn v1 (aggregatet har ikke produkt/kost per ordrelinje). Bruttofortjeneste speiler derfor kun omsetning inntil kost er koblet.",
      "Annonsespend er ikke hentet i v1 — satt til 0. Nettoresultat i visningen er bruttofortjeneste inntil spend kobles.",
    ],
    unitEconomics: [],
  };

  const rawFinancialAlerts = runAlertChecks(
    financialAlertInputFromControlTower({
      revenueOk: alertsDataTrusted,
      revenueToday: todayRoll.total,
      revenueYesterday: yesterdayRoll.total,
      finance: financeBlock,
      osloHour: osloNowParts().hh,
      ordersCountedToday: todayRes.rows.length,
    }),
  );
  const dispatchResult = await dispatchFinancialAlerts(rawFinancialAlerts);
  const financialAlerts = {
    triggered: dispatchResult.sent,
    suppressed: dispatchResult.suppressed,
    systemStatus: alertsDataTrusted ? ("ok" as const) : ("degraded" as const),
  };

  return {
    generatedAt,
    cacheTtlSeconds: REVALIDATE_SEC,
    financialAlerts,
    finance: financeBlock,
    revenue: {
      todayTotal: todayRoll.total,
      weekTotal: weekRoll.total,
      fromAiAttributed: weekRoll.aiTotal,
      fromAiAttributedToday: todayRoll.aiTotal,
      ordersCountedToday: todayRes.rows.length,
      ordersCountedWeek: weekRes.rows.length,
      weekTruncated: weekRes.truncated,
      dataSource: revenueOk ? "orders" : "unavailable",
    },
    ai: {
      decisions24h: aiRes.decisions24h,
      approved24h: aiRes.approved24h,
      skipped24h: aiRes.skipped24h,
      lowConfidence24h: aiRes.lowConfidence24h,
      lastCycleAt: aiRes.lastCycleAt,
      logAvailable: aiRes.ok,
    },
    performance: {
      topPostId: weekRoll.topPost?.id ?? null,
      topPostRevenue: weekRoll.topPost?.revenue ?? 0,
      topProductId: weekRoll.topProduct?.id ?? null,
      topProductRevenue: weekRoll.topProduct?.revenue ?? 0,
      aiAttributedShareWeek: aiShare,
    },
    system: {
      health: healthLevel,
      lastHealthCheckAt: healthRes?.timestamp ?? generatedAt,
      aiFailures24h: aiRes.failures24h,
      summary: healthSummary,
    },
    predictive: {
      dataAvailable: predictiveDataAvailable,
      insufficientDataMessage: fc.sufficientData ? null : fc.methodNb,
      forecast: {
        todayKr: fc.forecastToday,
        weekKr: fc.forecastWeek,
        confidence: fc.confidence,
        methodNb: fc.methodNb,
        daysUsed: fc.daysUsed,
        sufficientData: fc.sufficientData,
      },
      trend: {
        direction: trend.direction,
        strength: trend.strength,
        explainNb: trend.explainNb,
      },
      anomalies,
      recommendedActions,
      basis: {
        lookbackDays: PREDICTIVE_LOOKBACK_DAYS,
        seriesTruncated: predictiveCollected.seriesTruncated,
        conversionDropPercent,
      },
    },
    auditCompliance: {
      recent: auditSnap.recent,
      suspicious24h: auditSnap.suspicious24h,
      complianceStatus: auditSnap.complianceStatus,
    },
  };
}

/**
 * Kort cache (TTL) for å beskytte databasen; global snapshot (ikke bruker-spesifikk).
 */
export async function getControlTowerData(): Promise<ControlTowerData> {
  return unstable_cache(
    async () => loadControlTowerDataUncached(),
    ["control-tower-snapshot"],
    { revalidate: REVALIDATE_SEC, tags: [CACHE_TAG] },
  )();
}
