// lib/providers/loadProviderDashboard.ts
import "server-only";

import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { activeProviderCompanyIds } from "@/lib/providers/providerDashboardKpis";
import { supabaseServer } from "@/lib/supabase/server";

export type ProviderDashboardStats = {
  activeCustomers: number;
  activeAgreements: number;
  ordersThisWeek: number;
  revenueLast30DaysNok: number;
};

export type ProviderActivityItem = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  reason: string | null;
};

export type ProviderDashboardData = {
  stats: ProviderDashboardStats;
  recentActivity: ProviderActivityItem[];
};

function safeCount(n: unknown): number {
  const v = Number(n ?? 0);
  return Number.isFinite(v) ? v : 0;
}

function safeNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

async function countExact(q: PromiseLike<{ count: number | null; error: unknown }>): Promise<number> {
  try {
    const { count, error } = await q;
    if (error) return 0;
    return safeCount(count);
  } catch {
    return 0;
  }
}

/**
 * Provider-scoped dashboard metrics + recent lifecycle audit (fail-closed).
 */
export async function loadProviderDashboard(providerId: string): Promise<ProviderDashboardData> {
  const pid = String(providerId ?? "").trim();
  if (!pid) {
    return {
      stats: { activeCustomers: 0, activeAgreements: 0, ordersThisWeek: 0, revenueLast30DaysNok: 0 },
      recentActivity: [],
    };
  }

  const sb = await supabaseServer();
  const today = osloTodayISODate();
  const weekStart = startOfWeekISO(today);
  const weekEnd = addDaysISO(weekStart, 7);
  const revenueFrom = addDaysISO(today, -30);

  const activeCustomersP = countExact(
    sb
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", pid)
      .is("deleted_at", null)
      .is("suspended_at", null)
      .is("paused_at", null),
  );

  const activeAgreementsP = loadActiveCustomerAgreementsCount(sb, pid);

  const ordersWeekP = countExact(
    sb
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("provider_id", pid)
      .gte("date", weekStart)
      .lt("date", weekEnd)
      .eq("status", "ACTIVE"),
  );

  const [activeCustomers, activeAgreements, ordersThisWeek, revenueLast30DaysNok, recentActivity] = await Promise.all([
    activeCustomersP,
    activeAgreementsP,
    ordersWeekP,
    loadRevenueLast30(sb, pid, revenueFrom, today),
    loadRecentActivity(sb, pid),
  ]);

  return {
    stats: { activeCustomers, activeAgreements, ordersThisWeek, revenueLast30DaysNok },
    recentActivity,
  };
}

/**
 * Aktive kundeavtaler: aktive agreements for provider-bedrifter som fortsatt er
 * aktive (ikke slettet/suspendert/pauset) — samme lifecycle-definisjon som
 * «Aktive kunder». Avtaler på soft-slettede companies telles aldri (fail-closed 0).
 */
async function loadActiveCustomerAgreementsCount(
  sb: Awaited<ReturnType<typeof supabaseServer>>,
  providerId: string,
): Promise<number> {
  try {
    const { data, error } = await sb
      .from("companies")
      .select("id, deleted_at, suspended_at, paused_at")
      .eq("provider_id", providerId)
      .limit(1000);

    if (error || !Array.isArray(data)) return 0;

    const companyIds = activeProviderCompanyIds(data);
    if (companyIds.length === 0) return 0;

    return countExact(
      sb
        .from("agreements")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId)
        .in("company_id", companyIds)
        .eq("status", "ACTIVE"),
    );
  } catch {
    return 0;
  }
}

async function loadRevenueLast30(sb: Awaited<ReturnType<typeof supabaseServer>>, providerId: string, from: string, to: string) {
  try {
    const { data, error } = await sb
      .from("orders")
      .select("line_total")
      .eq("provider_id", providerId)
      .gte("date", from)
      .lte("date", to)
      .in("status", ["ACTIVE", "PAUSED"]);

    if (error || !Array.isArray(data)) return 0;
    let sum = 0;
    for (const row of data) {
      sum += safeNum((row as { line_total?: unknown })?.line_total);
    }
    return sum;
  } catch {
    return 0;
  }
}

async function loadRecentActivity(sb: Awaited<ReturnType<typeof supabaseServer>>, providerId: string) {
  try {
    const { data: companyRows } = await sb.from("companies").select("id").eq("provider_id", providerId).limit(500);
    const companyIds = new Set(
      (Array.isArray(companyRows) ? companyRows : [])
        .map((r) => String((r as { id?: string })?.id ?? "").trim())
        .filter(Boolean),
    );

    const { data, error } = await (sb as any)
      .from("lifecycle_audit_log")
      .select("id, created_at, action, entity_type, entity_id, reason, metadata")
      .order("created_at", { ascending: false })
      .limit(40);

    if (error || !Array.isArray(data)) return [];

    const filtered = data
      .filter((row: Record<string, unknown>) => {
        const meta = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
        const metaProvider = String(meta.provider_id ?? meta.providerId ?? "").trim();
        if (metaProvider === providerId) return true;
        const entityType = String(row.entity_type ?? "").toLowerCase();
        const entityId = String(row.entity_id ?? "").trim();
        if (entityType === "provider" && entityId === providerId) return true;
        if (entityType === "company" && companyIds.has(entityId)) return true;
        return false;
      })
      .slice(0, 5);

    return filtered.map((row: Record<string, unknown>) => ({
      id: String(row.id ?? ""),
      createdAt: String(row.created_at ?? ""),
      action: String(row.action ?? ""),
      entityType: String(row.entity_type ?? ""),
      reason: row.reason != null ? String(row.reason) : null,
    }));
  } catch {
    return [];
  }
}

function formatNok(amount: number) {
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK", maximumFractionDigits: 0 }).format(amount);
}

export function formatProviderRevenue(amount: number) {
  return formatNok(amount);
}
