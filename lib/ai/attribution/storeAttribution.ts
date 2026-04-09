import "server-only";

import { insertAiMemory } from "@/lib/ai/memory/aiMemory";
import { opsLog } from "@/lib/ops/log";
import { supabaseAdmin } from "@/lib/supabase/admin";

import type { AttributionRecord } from "./attributionModel";

function recordToPayload(record: AttributionRecord): Record<string, unknown> {
  return {
    actionType: record.actionType,
    source: record.source,
    ...(record.entityId != null ? { entityId: record.entityId } : {}),
    timestamp: record.timestamp,
    metrics: record.metrics,
  };
}

export async function storeAttribution(record: AttributionRecord, rid: string): Promise<void> {
  try {
    await insertAiMemory(supabaseAdmin(), {
      kind: "attribution_cycle",
      payload: recordToPayload(record),
      source_rid: rid.trim() || null,
      action_type: record.actionType,
    });
    opsLog("attribution_stored", {
      rid,
      actionType: record.actionType,
      source: record.source,
      entityId: record.entityId ?? null,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("attribution_store_failed", {
      rid,
      error: message,
      actionType: record.actionType,
    });
  }
}
