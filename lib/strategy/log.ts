import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { opsLog } from "@/lib/ops/log";

export const STRATEGY_AUDIT_KIND = "strategy_run" as const;

export async function logStrategyRun(
  admin: SupabaseClient,
  payload: {
    rid: string;
    windowDays: number;
    issueCount: number;
    roadmapCount: number;
    dataExplain: string;
  }
): Promise<void> {
  const row = buildAiActivityLogRow({
    action: "audit",
    metadata: {
      kind: STRATEGY_AUDIT_KIND,
      rid: payload.rid,
      windowDays: payload.windowDays,
      issues: payload.issueCount,
      roadmapItems: payload.roadmapCount,
      dataExplain: payload.dataExplain.slice(0, 2000),
      humanApprovalRequired: true,
    },
  });

  const { error } = await admin.from("ai_activity_log").insert(row as Record<string, unknown>);
  if (error) {
    opsLog("strategy_audit_insert_failed", { rid: payload.rid, message: error.message });
  } else {
    opsLog("strategy_audit_logged", { rid: payload.rid, issues: payload.issueCount });
  }
}
