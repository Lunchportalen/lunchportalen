import "server-only";

import { opsLog } from "@/lib/ops/log";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/** Minimal ordreprojeksjon for offentlig API (ingen PII-kolonner). */
export type PublicOrderRow = {
  id: string;
  date: string | null;
  status: string | null;
  slot: string | null;
  line_total: number | null;
  company_id: string | null;
};

/**
 * Tenant-isolert ordreliste — maks grense, deterministisk sortering.
 */
export async function getOrdersByTenant(tenantId: string, rid: string): Promise<{ rows: PublicOrderRow[] }> {
  const tid = String(tenantId ?? "").trim();
  if (!tid) {
    opsLog("public_orders_blocked", { rid, reason: "missing_tenant" });
    return { rows: [] };
  }

  if (!hasSupabaseAdminConfig()) {
    opsLog("public_orders_unavailable", { rid, reason: "no_supabase_admin" });
    return { rows: [] };
  }

  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from("orders")
    .select("id, date, status, slot, line_total, company_id")
    .eq("company_id", tid)
    .in("status", ["active", "ACTIVE"])
    .order("date", { ascending: false })
    .limit(500);

  if (error) {
    opsLog("public_orders_read_failed", { rid, tenantId: tid, message: error.message });
    return { rows: [] };
  }

  const rows = (Array.isArray(data) ? data : []).map((r) => {
    const row = r as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      date: typeof row.date === "string" ? row.date : null,
      status: typeof row.status === "string" ? row.status : null,
      slot: typeof row.slot === "string" ? row.slot : null,
      line_total: typeof row.line_total === "number" ? row.line_total : row.line_total != null ? Number(row.line_total) : null,
      company_id: typeof row.company_id === "string" ? row.company_id : null,
    } satisfies PublicOrderRow;
  });

  opsLog("public_orders_read", { rid, tenantId: tid, count: rows.length, purpose: "gdpr_minimal_projection" });
  return { rows };
}
