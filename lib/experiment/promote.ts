import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

const ROUTE = "promote_social_winner";

export type PromoteWinnerResult = { ok: true } | { ok: false; error: string };

/**
 * Copies winning post JSON content onto target (both must be planned). Deterministic; no AI.
 */
export async function promoteWinner(
  admin: SupabaseClient,
  params: {
    rid: string;
    winnerPostId: string;
    targetPostId: string;
  }
): Promise<PromoteWinnerResult> {
  const ok = await verifyTable(admin, "social_posts", ROUTE);
  if (!ok) return { ok: false, error: "table_unavailable" };

  const { data: w, error: wErr } = await admin.from("social_posts").select("*").eq("id", params.winnerPostId).maybeSingle();
  const { data: t, error: tErr } = await admin.from("social_posts").select("*").eq("id", params.targetPostId).maybeSingle();
  if (wErr || tErr || !w || !t) return { ok: false, error: "post_missing" };

  const wt = w as Record<string, unknown>;
  const tt = t as Record<string, unknown>;
  if (wt.status !== "planned" || tt.status !== "planned") {
    return { ok: false, error: "not_planned_safe_gate" };
  }

  const now = new Date().toISOString();
  const { error: uErr } = await admin
    .from("social_posts")
    .update({
      content: wt.content as Record<string, unknown>,
      updated_at: now,
    } as Record<string, unknown>)
    .eq("id", params.targetPostId)
    .eq("status", "planned");

  if (uErr) return { ok: false, error: uErr.message };

  const logRow = buildAiActivityLogRow({
    action: "experiment_event",
    metadata: {
      kind: "revenue_promote_winner",
      rid: params.rid,
      winner_post_id: params.winnerPostId,
      target_post_id: params.targetPostId,
    },
  });
  await admin.from("ai_activity_log").insert({ ...logRow, rid: params.rid, status: "success" } as Record<string, unknown>);

  opsLog("revenue_winner_promoted", { rid: params.rid, target: params.targetPostId });
  return { ok: true };
}
