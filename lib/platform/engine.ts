import "server-only";

import { buildMarketInsights } from "@/lib/data/moat";
import { listPartners } from "@/lib/partners/registry";
import { networkValueFromCounts } from "@/lib/network/effects";
import { opsLog } from "@/lib/ops/log";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Plattform-puls — aggregater + nettverksindikator (ingen PII-rådata i retur).
 */
export async function runPlatform(): Promise<{
  insights: ReturnType<typeof buildMarketInsights>;
  networkValue: number;
  partnerCount: number;
  companyCount: number;
}> {
  const partners = listPartners();
  let companyCount = 0;
  const values: { value: number }[] = [];

  if (hasSupabaseAdminConfig()) {
    try {
      const admin = supabaseAdmin();
      const { count } = await admin.from("companies").select("id", { count: "exact", head: true });
      companyCount = typeof count === "number" ? count : 0;

      const { data: orders, error } = await admin
        .from("orders")
        .select("line_total")
        .limit(8000)
        .in("status", ["active", "ACTIVE"]);

      if (!error && Array.isArray(orders)) {
        for (const row of orders) {
          const r = row as { line_total?: unknown };
          const v = typeof r.line_total === "number" ? r.line_total : Number(r.line_total);
          values.push({ value: Number.isFinite(v) ? v : 0 });
        }
      }
    } catch (e) {
      opsLog("platform_engine_read_failed", { message: String(e) });
    }
  }

  const insights = buildMarketInsights(values);
  const nv = networkValueFromCounts(companyCount, partners.length);

  opsLog("platform_engine_tick", {
    companyCount,
    partnerCount: partners.length,
    networkValue: nv,
    sampleOrders: values.length,
  });

  return {
    insights,
    networkValue: nv,
    partnerCount: partners.length,
    companyCount,
  };
}
