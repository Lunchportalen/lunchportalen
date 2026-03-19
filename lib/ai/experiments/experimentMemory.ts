/**
 * Experiment learning memory: store and list historical experiment results in ai_experiment_memory.
 * Server-only; use with Supabase client that has RLS (superadmin for this table).
 */

export type ExperimentMemoryOutcome = "winner" | "runner_up" | "other";
export type ExperimentMemoryPrimaryMetric = "conversions" | "clicks" | "views";

export type AiExperimentMemoryRow = {
  id: string;
  experiment_id: string;
  page_id: string | null;
  variant: string;
  outcome: ExperimentMemoryOutcome;
  views: number;
  clicks: number;
  conversions: number;
  primary_metric: ExperimentMemoryPrimaryMetric;
  snapshot_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AiExperimentMemoryInsert = {
  experiment_id: string;
  page_id?: string | null;
  variant: string;
  outcome: ExperimentMemoryOutcome;
  views: number;
  clicks: number;
  conversions: number;
  primary_metric?: ExperimentMemoryPrimaryMetric;
  snapshot_at?: string;
  metadata?: Record<string, unknown>;
};

export type ListExperimentMemoryOpts = {
  experimentId?: string;
  pageId?: string;
  outcome?: ExperimentMemoryOutcome;
  since?: string;
  limit?: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function insertExperimentMemory(
  supabase: any,
  row: AiExperimentMemoryInsert
): Promise<AiExperimentMemoryRow> {
  const payload = {
    experiment_id: row.experiment_id,
    page_id: row.page_id ?? null,
    variant: row.variant,
    outcome: row.outcome,
    views: Math.max(0, row.views),
    clicks: Math.max(0, row.clicks),
    conversions: Math.max(0, row.conversions),
    primary_metric: row.primary_metric ?? "conversions",
    snapshot_at: row.snapshot_at ?? new Date().toISOString(),
    metadata: row.metadata ?? {},
  };
  const { data, error } = await supabase.from("ai_experiment_memory").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as AiExperimentMemoryRow;
}

export async function insertExperimentMemoryBatch(
  supabase: any,
  rows: AiExperimentMemoryInsert[]
): Promise<AiExperimentMemoryRow[]> {
  if (rows.length === 0) return [];
  const payloads = rows.map((row) => ({
    experiment_id: row.experiment_id,
    page_id: row.page_id ?? null,
    variant: row.variant,
    outcome: row.outcome,
    views: Math.max(0, row.views),
    clicks: Math.max(0, row.clicks),
    conversions: Math.max(0, row.conversions),
    primary_metric: row.primary_metric ?? "conversions",
    snapshot_at: row.snapshot_at ?? new Date().toISOString(),
    metadata: row.metadata ?? {},
  }));
  const { data, error } = await supabase.from("ai_experiment_memory").insert(payloads).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as AiExperimentMemoryRow[];
}

export async function listExperimentMemory(
  supabase: any,
  opts?: ListExperimentMemoryOpts
): Promise<AiExperimentMemoryRow[]> {
  let q = supabase
    .from("ai_experiment_memory")
    .select("*")
    .order("snapshot_at", { ascending: false });
  if (opts?.experimentId) q = q.eq("experiment_id", opts.experimentId);
  if (opts?.pageId) q = q.eq("page_id", opts.pageId);
  if (opts?.outcome) q = q.eq("outcome", opts.outcome);
  if (opts?.since) q = q.gte("snapshot_at", opts.since);
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
  q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as AiExperimentMemoryRow[];
}
