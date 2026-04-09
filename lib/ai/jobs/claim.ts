/**
 * Phase 43A: Concurrency-safe claim of pending AI jobs. Uses DB function for atomic update.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ClaimedJob = {
  id: string;
  tool: string;
  status: string;
  input: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  next_run_at: string;
  locked_by: string | null;
  locked_at: string | null;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};

export async function claimPendingJobs(
  supabase: SupabaseClient,
  options: { limit: number; runnerId: string }
): Promise<ClaimedJob[]> {
  const { limit, runnerId } = options;
  const { data, error } = await supabase.rpc("claim_ai_jobs", {
    p_limit: limit,
    p_runner_id: runnerId,
  });
  if (error) return [];
  const rows = Array.isArray(data) ? data : [];
  return rows.map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ""),
    tool: String(r.tool ?? ""),
    status: String(r.status ?? ""),
    input: (r.input && typeof r.input === "object" && !Array.isArray(r.input) ? r.input : {}) as Record<string, unknown>,
    attempts: typeof r.attempts === "number" ? r.attempts : 0,
    max_attempts: typeof r.max_attempts === "number" ? r.max_attempts : 5,
    next_run_at: String(r.next_run_at ?? new Date().toISOString()),
    locked_by: r.locked_by != null ? String(r.locked_by) : null,
    locked_at: r.locked_at != null ? String(r.locked_at) : null,
    created_by: r.created_by != null ? String(r.created_by) : null,
    created_at: String(r.created_at ?? ""),
    started_at: r.started_at != null ? String(r.started_at) : null,
    finished_at: r.finished_at != null ? String(r.finished_at) : null,
  }));
}