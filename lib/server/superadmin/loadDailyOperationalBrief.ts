// lib/server/superadmin/loadDailyOperationalBrief.ts
/** Superadmin morgenoversikt: kombinerer canonical production readiness, snapshot-telling og operative audit_events (read-only). */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { OPERATIVE_AUDIT_EVENTS_OR } from "@/lib/audit/operativeAuditStream";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { loadProductionReadiness, type ProductionReadinessPayload } from "@/lib/server/superadmin/loadProductionReadiness";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export type DailyOperationalBriefAuditRow = {
  id: string;
  created_at: string;
  action: string | null;
  summary: string | null;
  entity_type: string | null;
  entity_id: string | null;
};

export type DailyOperationalBriefPayload = {
  date: string;
  production: ProductionReadinessPayload;
  /** Antall firma med materialisert operative snapshot for datoen (0 hvis tabell mangler / feil). */
  snapshot_company_count: number;
  /** Sum av canonical anomaly-tall fra production check. */
  anomaly_total: number;
  audit_tail: DailyOperationalBriefAuditRow[];
};

export function sumProductionAnomalies(p: ProductionReadinessPayload): number {
  const a = p.anomalies;
  return (
    (a.orders_missing_scope ?? 0) +
    (a.ghost_active_orders_with_cancelled_day_choice ?? 0) +
    (a.operative_orders_missing_outbox ?? 0) +
    (a.outbox_order_set_without_active_order ?? 0)
  );
}

async function countSnapshotsForDate(admin: SupabaseClient, dateISO: string): Promise<number> {
  const { count, error } = await admin
    .from("production_operative_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("delivery_date", dateISO);
  if (error) {
    const m = safeStr(error.message).toLowerCase();
    if (!m.includes("does not exist") && !m.includes("relation") && !m.includes("schema cache")) {
      console.warn("[loadDailyOperationalBrief] snapshot count", safeStr(error.message));
    }
    return 0;
  }
  return typeof count === "number" ? count : 0;
}

async function loadOperativeAuditTail(admin: SupabaseClient, limit = 8): Promise<DailyOperationalBriefAuditRow[]> {
  const { data, error } = await admin
    .from("audit_events")
    .select("id,created_at,action,summary,entity_type,entity_id")
    .or(OPERATIVE_AUDIT_EVENTS_OR)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) {
    const m = safeStr(error?.message).toLowerCase();
    if (error && !m.includes("does not exist") && !m.includes("relation") && !m.includes("schema cache")) {
      console.warn("[loadDailyOperationalBrief] audit_tail", safeStr(error?.message));
    }
    return [];
  }

  return data.map((x: Record<string, unknown>) => ({
    id: safeStr(x.id),
    created_at: safeStr(x.created_at),
    action: x.action != null ? safeStr(x.action) : null,
    summary: x.summary != null ? safeStr(x.summary) : null,
    entity_type: x.entity_type != null ? safeStr(x.entity_type) : null,
    entity_id: x.entity_id != null ? safeStr(x.entity_id) : null,
  })).filter((r) => r.id && r.created_at);
}

export async function loadDailyOperationalBrief(dateISO: string): Promise<DailyOperationalBriefPayload> {
  const date = safeStr(dateISO);
  const production = await loadProductionReadiness(date);

  let snapshot_company_count = 0;
  let audit_tail: DailyOperationalBriefAuditRow[] = [];

  try {
    const admin = supabaseAdmin() as unknown as SupabaseClient;
    const [snap, tail] = await Promise.all([countSnapshotsForDate(admin, date), loadOperativeAuditTail(admin, 8)]);
    snapshot_company_count = snap;
    audit_tail = tail;
  } catch {
    /* service role mangler — behold production + tomme tillegg */
  }

  return {
    date,
    production,
    snapshot_company_count,
    anomaly_total: sumProductionAnomalies(production),
    audit_tail,
  };
}
