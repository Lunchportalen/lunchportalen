// lib/providers/loadProviderCustomerDetail.ts
import "server-only";

import { addDaysISO, osloTodayISODate } from "@/lib/date/oslo";
import { supabaseServer } from "@/lib/supabase/server";

import type { ProviderActivityItem } from "@/lib/providers/loadProviderDashboard";
import type { ProviderCustomerStatus } from "@/lib/providers/customerTypes";

export type ProviderCompanyDetail = {
  id: string;
  name: string;
  status: ProviderCustomerStatus;
  providerId: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  pausedAt: string | null;
  pausedReason: string | null;
  deletedAt: string | null;
  updatedAt: string | null;
};

export type ProviderCompanyStats = {
  employeesCount: number;
  activeOrdersCount: number;
  monthlyRevenueNok: number;
};

export type ProviderAgreementRow = {
  id: string;
  status: string;
  createdAt: string | null;
};

export type ProviderOrderRow = {
  id: string;
  date: string;
  status: string;
  lineTotal: number | null;
};

export type ProviderCustomerDetail = {
  company: ProviderCompanyDetail;
  stats: ProviderCompanyStats;
  agreements: ProviderAgreementRow[];
  orders: ProviderOrderRow[];
  activity: ProviderActivityItem[];
};

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function safeNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function deriveStatus(row: {
  deleted_at?: string | null;
  suspended_at?: string | null;
  paused_at?: string | null;
}): ProviderCustomerStatus {
  if (row.deleted_at) return "DELETED";
  if (row.suspended_at) return "SUSPENDED";
  if (row.paused_at) return "PAUSED";
  return "ACTIVE";
}

/**
 * Load one company in provider scope. Returns null when missing or cross-provider.
 */
export async function loadProviderCustomerDetail(
  providerId: string,
  companyId: string,
): Promise<ProviderCustomerDetail | null> {
  const pid = safeStr(providerId);
  const cid = safeStr(companyId);
  if (!pid || !cid) return null;

  const sb = await supabaseServer();
  const { data: row, error } = await (sb as any)
    .from("companies")
    .select(
      "id, name, provider_id, updated_at, deleted_at, suspended_at, suspended_reason, paused_at, paused_reason",
    )
    .eq("id", cid)
    .maybeSingle();

  if (error || !row || safeStr(row.provider_id) !== pid) return null;

  const company: ProviderCompanyDetail = {
    id: cid,
    name: safeStr(row.name) || "Uten navn",
    status: deriveStatus(row),
    providerId: pid,
    suspendedAt: row.suspended_at != null ? String(row.suspended_at) : null,
    suspendedReason: row.suspended_reason != null ? String(row.suspended_reason) : null,
    pausedAt: row.paused_at != null ? String(row.paused_at) : null,
    pausedReason: row.paused_reason != null ? String(row.paused_reason) : null,
    deletedAt: row.deleted_at != null ? String(row.deleted_at) : null,
    updatedAt: row.updated_at != null ? String(row.updated_at) : null,
  };

  const today = osloTodayISODate();
  const monthStart = addDaysISO(today, -30);

  const [employeesP, ordersActiveP, ordersMonthP, agreementsP, ordersP, activityP] = await Promise.all([
    sb.from("profiles").select("id", { count: "exact", head: true }).eq("company_id", cid).is("disabled_at", null),
    sb.from("orders").select("id", { count: "exact", head: true }).eq("company_id", cid).eq("status", "ACTIVE"),
    sb.from("orders").select("line_total").eq("company_id", cid).gte("date", monthStart).lte("date", today).in("status", ["ACTIVE", "PAUSED"]),
    sb.from("agreements").select("id, status, created_at").eq("company_id", cid).order("created_at", { ascending: false }).limit(10),
    sb.from("orders").select("id, date, status, line_total").eq("company_id", cid).order("date", { ascending: false }).limit(20),
    (sb as any)
      .from("lifecycle_audit_log")
      .select("id, created_at, action, entity_type, reason")
      .eq("entity_type", "company")
      .eq("entity_id", cid)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  let monthlyRevenueNok = 0;
  for (const o of Array.isArray(ordersMonthP.data) ? ordersMonthP.data : []) {
    monthlyRevenueNok += safeNum((o as { line_total?: unknown }).line_total);
  }

  const stats: ProviderCompanyStats = {
    employeesCount: safeNum(employeesP.count),
    activeOrdersCount: safeNum(ordersActiveP.count),
    monthlyRevenueNok,
  };

  const agreements: ProviderAgreementRow[] = (Array.isArray(agreementsP.data) ? agreementsP.data : []).map(
    (a: Record<string, unknown>) => ({
      id: safeStr(a.id),
      status: safeStr(a.status) || "UNKNOWN",
      createdAt: a.created_at != null ? String(a.created_at) : null,
    }),
  );

  const orders: ProviderOrderRow[] = (Array.isArray(ordersP.data) ? ordersP.data : []).map((o: Record<string, unknown>) => ({
    id: safeStr(o.id),
    date: safeStr(o.date),
    status: safeStr(o.status),
    lineTotal: o.line_total != null ? safeNum(o.line_total) : null,
  }));

  const activity: ProviderActivityItem[] = (Array.isArray(activityP.data) ? activityP.data : []).map(
    (a: Record<string, unknown>) => ({
      id: safeStr(a.id),
      createdAt: String(a.created_at ?? ""),
      action: safeStr(a.action),
      entityType: safeStr(a.entity_type),
      reason: a.reason != null ? String(a.reason) : null,
    }),
  );

  return { company, stats, agreements, orders, activity };
}
