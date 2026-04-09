import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import type { MonitoringAlert } from "@/lib/monitoring/types";

import type { SelfHealConfig } from "./config";

export const SELF_HEAL_AUDIT_KIND = "self_heal_run" as const;

export async function logSelfHealAudit(
  admin: SupabaseClient,
  payload: {
    rid: string;
    monitoringRid: string;
    config: Pick<SelfHealConfig, "enabled" | "mode" | "maxActionsPerRun" | "cooldownMinutes">;
    alerts: MonitoringAlert[];
    planned: unknown[];
    results: unknown[];
    verification?: unknown;
    rollback?: unknown[];
    note?: string;
    hadExecution: boolean;
    cooldownSkipped?: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const row = buildAiActivityLogRow({
    action: "audit",
    metadata: {
      kind: SELF_HEAL_AUDIT_KIND,
      ...payload,
    },
  });

  const { error } = await admin.from("ai_activity_log").insert(row as Record<string, unknown>);
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
