import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { verifyTable } from "@/lib/db/verifyTable";
import type { SupabaseClient } from "@supabase/supabase-js";

import { opsLog } from "@/lib/ops/log";

const ROUTE = "social_experiment_promote_content";

export type PromoteSocialContentResult = { ok: true } | { ok: false; error: string };

/**
 * Oppdaterer `social_posts.content` for planlagt post (vinner-innhold), med audit.
 * Skiller seg fra `promoteWinner` (kopier mellom to poster).
 */
export async function promoteWinningSocialContent(
  admin: SupabaseClient,
  params: {
    postId: string;
    winnerContent: Record<string, unknown>;
    rid: string;
  }
): Promise<PromoteSocialContentResult> {
  const ok = await verifyTable(admin, "social_posts", ROUTE);
  if (!ok) return { ok: false, error: "table_unavailable" };

  const { data: row, error: qErr } = await admin.from("social_posts").select("id, status").eq("id", params.postId).maybeSingle();
  if (qErr || !row) return { ok: false, error: "post_missing" };
  const st = (row as { status?: unknown }).status;
  if (st !== "planned") {
    return { ok: false, error: "not_planned_safe_gate" };
  }

  const merged = {
    ...params.winnerContent,
    source: "autonomous",
  };

  const { error: uErr } = await admin
    .from("social_posts")
    .update({
      content: merged as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    } as Record<string, unknown>)
    .eq("id", params.postId)
    .eq("status", "planned");

  if (uErr) return { ok: false, error: uErr.message };

  const logRow = buildAiActivityLogRow({
    action: "experiment_event",
    metadata: {
      kind: "social_content_promote",
      rid: params.rid,
      postId: params.postId,
    },
  });
  await admin.from("ai_activity_log").insert({ ...logRow, rid: params.rid, status: "success" } as Record<string, unknown>);
  opsLog("social_experiment_promote_content", { rid: params.rid, postId: params.postId });
  return { ok: true };
}
