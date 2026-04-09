import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import { supabaseAdmin } from "@/lib/supabase/admin";

const META_MAX = 48_000;

function shrinkMeta(v: Record<string, unknown>): Record<string, unknown> {
  try {
    const s = JSON.stringify(v);
    if (s.length <= META_MAX) return v;
    return { truncated: true, preview: s.slice(0, META_MAX) };
  } catch {
    return { error: "unserializable" };
  }
}

export async function logAutonomousExecution(opts: {
  rid: string;
  actorEmail: string | null;
  mode: string;
  simulated: boolean;
  results: unknown;
  prepared: unknown;
  config: unknown;
}): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", "autonomy_run");
    if (!ok) return;

    const metadata = shrinkMeta({
      kind: "autonomous_execution",
      autonomous_execution: true,
      mode: opts.mode,
      simulated: opts.simulated,
      rid: opts.rid,
      results: opts.results,
      prepared: opts.prepared,
      config: opts.config,
    });

    const row = buildAiActivityLogRow({
      action: "agent_run",
      actor_user_id: opts.actorEmail ?? null,
      metadata,
      tool: "autonomy",
    });

    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid: opts.rid,
      status: "success",
    } as Record<string, unknown>);
    if (error) {
      console.error("[AUTONOMY_LOG_INSERT]", error.message);
    }
  } catch (e) {
    console.error("[AUTONOMY_AUDIT]", e);
  }
}
