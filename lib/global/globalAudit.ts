import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { supabaseAdmin } from "@/lib/supabase/admin";

const META_MAX = 32_000;

function shrinkMeta(v: Record<string, unknown>): Record<string, unknown> {
  try {
    const s = JSON.stringify(v);
    if (s.length <= META_MAX) return v;
    return { truncated: true, preview: s.slice(0, META_MAX) };
  } catch {
    return { error: "unserializable" };
  }
}

/**
 * Observabilitet per marked — `action` = allowlist. `market_id` i metadata (ingen skjemaendring).
 */
export async function logGlobalMarketEvent(opts: {
  rid: string;
  marketId: string;
  phase: "start" | "done" | "error";
  actorEmail: string | null;
  summary?: unknown;
}): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", "global_run");
    if (!ok) return;

    const metadata = shrinkMeta({
      kind: "global_market",
      market_id: opts.marketId,
      phase: opts.phase,
      rid: opts.rid,
      summary: opts.summary ?? null,
    });

    const row = buildAiActivityLogRow({
      action: "agent_run",
      actor_user_id: opts.actorEmail ?? null,
      metadata,
      tool: "global_control_tower",
    });

    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      entity_id: opts.marketId,
      rid: opts.rid,
      status: opts.phase === "error" ? "error" : "success",
    } as Record<string, unknown>);
    if (error) {
      console.error("[GLOBAL_AUDIT_INSERT]", error.message);
    }
  } catch (e) {
    console.error("[GLOBAL_AUDIT]", e);
  }
}
