import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

const AUTO_ACTIONS = ["downgrade_company_model_tier", "throttle_tool_platform"] as const;

function isAutoSuccessRow(row: {
  result: unknown;
  rolled_back_at: string | null;
}): boolean {
  if (row.rolled_back_at) return false;
  const r = row.result;
  if (!r || typeof r !== "object" || Array.isArray(r)) return false;
  const o = r as Record<string, unknown>;
  if (o.ok !== true) return false;
  if (o.execution_source !== "auto") return false;
  return true;
}

export type AutoExecutionPeriodMetrics = {
  /** Successful auto applies in period (not rolled back). */
  total_auto_applies: number;
  /** Latest auto downgrade per company (ISO created_at). */
  last_downgrade_at_by_company: Map<string, string>;
  /** Latest auto throttle per tool (ISO created_at). */
  last_throttle_at_by_tool: Map<string, string>;
};

/**
 * Loads recent auto-execution rows for billing-period caps and per-target cooldowns.
 */
export async function loadAutoExecutionMetricsSince(periodStartIso: string): Promise<AutoExecutionPeriodMetrics> {
  const last_downgrade_at_by_company = new Map<string, string>();
  const last_throttle_at_by_tool = new Map<string, string>();
  let total_auto_applies = 0;

  const { data, error } = await supabaseAdmin()
    .from("ai_governance_apply_log")
    .select("created_at, action, payload, result, rolled_back_at")
    .eq("dry_run", false)
    .gte("created_at", periodStartIso)
    .in("action", [...AUTO_ACTIONS])
    .order("created_at", { ascending: false })
    .limit(2500);

  if (error) {
    throw new Error(`AUTO_METRICS_READ_FAILED: ${error.message}`);
  }

  const rows = Array.isArray(data) ? data : [];
  for (const row of rows) {
    const created =
      typeof row.created_at === "string" && row.created_at.trim() ? row.created_at.trim() : "";
    if (!created) continue;
    if (!isAutoSuccessRow(row)) continue;

    total_auto_applies += 1;
    const action = typeof row.action === "string" ? row.action : "";

    const payload =
      row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
        ? (row.payload as Record<string, unknown>)
        : {};

    if (action === "downgrade_company_model_tier") {
      const cid = typeof payload.company_id === "string" ? payload.company_id.trim() : "";
      if (cid && !last_downgrade_at_by_company.has(cid)) {
        last_downgrade_at_by_company.set(cid, created);
      }
    }
    if (action === "throttle_tool_platform") {
      const tool = typeof payload.tool === "string" ? payload.tool.trim() : "";
      if (tool && !last_throttle_at_by_tool.has(tool)) {
        last_throttle_at_by_tool.set(tool, created);
      }
    }
  }

  return {
    total_auto_applies,
    last_downgrade_at_by_company,
    last_throttle_at_by_tool,
  };
}
