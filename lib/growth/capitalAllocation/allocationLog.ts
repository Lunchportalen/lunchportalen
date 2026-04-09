import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import type { CapitalChannelId } from "@/lib/growth/capitalAllocation/types";
import { CAPITAL_CHANNELS } from "@/lib/growth/capitalAllocation/types";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";

const ROUTE = "capital_allocation_log";
export const ALLOCATION_ACTION = "allocation_update";

export type AllocationLogPayload = {
  action: typeof ALLOCATION_ACTION;
  market: string;
  before: Record<string, number>;
  after: Record<string, number>;
  reason: string;
  metricsSnapshot: { revenue: number; retention: number; dwell: number };
  guardsRolledBack: boolean;
  rid: string;
};

export async function loadLastAllocationSnapshots(
  admin: SupabaseClient,
): Promise<
  Map<
    string,
    {
      after: Record<CapitalChannelId, number>;
      metricsSnapshot: { revenue: number; retention: number; dwell: number };
    }
  >
> {
  const out = new Map<
    string,
    { after: Record<CapitalChannelId, number>; metricsSnapshot: { revenue: number; retention: number; dwell: number } }
  >();
  const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
  if (!ok) return out;

  const { data, error } = await admin
    .from("ai_activity_log")
    .select("metadata, created_at")
    .eq("action", ALLOCATION_ACTION)
    .order("created_at", { ascending: false })
    .limit(400);

  if (error || !Array.isArray(data)) return out;

  for (const row of data) {
    const m = row && typeof row === "object" ? (row as { metadata?: unknown }).metadata : null;
    if (!m || typeof m !== "object" || Array.isArray(m)) continue;
    const meta = m as Record<string, unknown>;
    const market = typeof meta.market === "string" ? meta.market.trim().toUpperCase() : "";
    if (!market || out.has(market)) continue;
    const before = meta.before;
    const after = meta.after;
    const snap = meta.metricsSnapshot;
    if (!isWeights(after)) continue;
    if (!isSnapshot(snap)) continue;
    out.set(market, {
      after: after as Record<CapitalChannelId, number>,
      metricsSnapshot: snap,
    });
  }

  return out;
}

function isWeights(v: unknown): v is Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return CAPITAL_CHANNELS.every((c) => typeof o[c] === "number");
}

function isSnapshot(v: unknown): v is { revenue: number; retention: number; dwell: number } {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.revenue === "number" &&
    typeof o.retention === "number" &&
    typeof o.dwell === "number"
  );
}

export async function logAllocationUpdate(payload: AllocationLogPayload): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return;
    const row = buildAiActivityLogRow({
      action: ALLOCATION_ACTION,
      metadata: {
        ...payload,
      },
    });
    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid: payload.rid,
      status: "success" as const,
    } as Record<string, unknown>);
    if (error) console.error("[capital_allocation]", error.message);
  } catch (e) {
    console.error("[capital_allocation]", e instanceof Error ? e.message : String(e));
  }
}
