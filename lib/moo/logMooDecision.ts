import "server-only";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

export type MooDecisionMetadata = {
  before: unknown;
  after: unknown;
  scoreBefore: number;
  scoreAfter: number;
  applied: boolean;
  winnerVariantId: string | null;
  normalizedA: unknown;
  normalizedB: unknown;
  rawA: unknown;
  rawB: unknown;
  reason?: string;
  /** Extended MOO v2 */
  normalizedC?: unknown;
  rawC?: unknown;
  softPareto?: boolean;
  confidenceBand?: string;
  minRevenueGainNormalized?: number;
  candidatesEvaluated?: string[];
};

/**
 * Persists MOO outcome to `ai_activity_log` (best-effort; never throws).
 */
export async function logMooDecision(opts: {
  rid: string;
  experimentId: string;
  pageId: string | null;
  metadata: MooDecisionMetadata;
}): Promise<void> {
  if (!hasSupabaseAdminConfig()) return;
  try {
    const admin = supabaseAdmin();
    const row = buildAiActivityLogRow({
      action: "moo_decision",
      page_id: opts.pageId,
      metadata: {
        experimentId: opts.experimentId,
        ...opts.metadata,
        rid: opts.rid,
      },
    });
    await admin.from("ai_activity_log").insert({
      ...row,
      rid: opts.rid,
      status: "success",
    } as Record<string, unknown>);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(JSON.stringify({ scope: "moo.logMooDecision", message, rid: opts.rid }));
  }
}
