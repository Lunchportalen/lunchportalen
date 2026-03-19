/**
 * AI Experiment Engine: persistence for ai_experiments and ai_experiment_results.
 * Tabeller: ai_experiments, ai_experiment_results.
 * Server-only; RLS superadmin.
 */

export type AiExperimentStatus = "draft" | "active" | "paused" | "completed";

export type AiExperimentVariantSpec = {
  id: string;
  label?: string | null;
  [key: string]: unknown;
};

export type AiExperimentRow = {
  id: string;
  name: string;
  status: AiExperimentStatus;
  target_type: string | null;
  primary_metric: string | null;
  variants: AiExperimentVariantSpec[];
  winner_variant: string | null;
  page_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
};

export type AiExperimentInsert = {
  name: string;
  status?: AiExperimentStatus | null;
  target_type?: string | null;
  primary_metric?: string | null;
  variants?: AiExperimentVariantSpec[] | null;
  page_id?: string | null;
};

export type AiExperimentUpdate = {
  status?: AiExperimentStatus | null;
  winner_variant?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
};

export type AiExperimentResultRow = {
  id: string;
  experiment_id: string;
  variant: string;
  views: number;
  clicks: number;
  conversions: number;
  created_at: string;
};

export type AiExperimentVariantStats = {
  variant: string;
  views: number;
  clicks: number;
  conversions: number;
};

export type AiExperimentStats = {
  experimentId: string;
  views: number;
  clicks: number;
  conversions: number;
  variants: string[];
  byVariant: AiExperimentVariantStats[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toExperimentRow(raw: Record<string, unknown>): AiExperimentRow {
  const variants = raw.variants;
  const arr = Array.isArray(variants)
    ? (variants as unknown[]).filter((v) => v != null && typeof v === "object")
    : [];
  return {
    id: String(raw.id ?? ""),
    name: String(raw.name ?? ""),
    status: (raw.status as AiExperimentStatus) ?? "draft",
    target_type: raw.target_type != null ? String(raw.target_type) : null,
    primary_metric: raw.primary_metric != null ? String(raw.primary_metric) : null,
    variants: arr as AiExperimentVariantSpec[],
    winner_variant: raw.winner_variant != null ? String(raw.winner_variant) : null,
    page_id: raw.page_id != null ? String(raw.page_id) : null,
    started_at: raw.started_at != null ? String(raw.started_at) : null,
    completed_at: raw.completed_at != null ? String(raw.completed_at) : null,
    created_at: String(raw.created_at ?? ""),
    updated_at: raw.updated_at != null ? String(raw.updated_at) : null,
  };
}

export async function insertAiExperiment(
  supabase: any,
  row: AiExperimentInsert
): Promise<AiExperimentRow> {
  const payload = {
    name: row.name,
    status: row.status ?? "draft",
    target_type: row.target_type ?? null,
    primary_metric: row.primary_metric ?? null,
    variants: Array.isArray(row.variants) ? row.variants : [],
    page_id: row.page_id ?? null,
  };
  const { data, error } = await supabase.from("ai_experiments").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return toExperimentRow(data as Record<string, unknown>);
}

export async function listAiExperiments(
  supabase: any,
  opts?: { status?: AiExperimentStatus; pageId?: string; limit?: number }
): Promise<AiExperimentRow[]> {
  let q = supabase
    .from("ai_experiments")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts?.status) q = q.eq("status", opts.status);
  if (opts?.pageId) q = q.eq("page_id", opts.pageId);
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
  q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const list = Array.isArray(data) ? data : [];
  return list.map((r: Record<string, unknown>) => toExperimentRow(r));
}

export async function getAiExperimentById(supabase: any, id: string): Promise<AiExperimentRow | null> {
  const { data, error } = await supabase.from("ai_experiments").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return toExperimentRow(data as Record<string, unknown>);
}

export async function updateAiExperiment(
  supabase: any,
  id: string,
  update: AiExperimentUpdate
): Promise<AiExperimentRow> {
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (update.status !== undefined) payload.status = update.status;
  if (update.winner_variant !== undefined) payload.winner_variant = update.winner_variant;
  if (update.started_at !== undefined) payload.started_at = update.started_at;
  if (update.completed_at !== undefined) payload.completed_at = update.completed_at;
  if (update.updated_at !== undefined) payload.updated_at = update.updated_at;
  const { data, error } = await supabase
    .from("ai_experiments")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return toExperimentRow(data as Record<string, unknown>);
}

/** Oppdaterer ai_experiment_results: view for variant. */
export async function recordAiExperimentView(
  supabase: any,
  experimentId: string,
  variant: string
): Promise<void> {
  const { data: row } = await supabase
    .from("ai_experiment_results")
    .select("views")
    .eq("experiment_id", experimentId)
    .eq("variant", variant)
    .maybeSingle();
  if (row && typeof row.views === "number") {
    await supabase
      .from("ai_experiment_results")
      .update({ views: row.views + 1 })
      .eq("experiment_id", experimentId)
      .eq("variant", variant);
  } else {
    await supabase.from("ai_experiment_results").upsert(
      { experiment_id: experimentId, variant, views: 1, clicks: 0, conversions: 0 },
      { onConflict: "experiment_id,variant" }
    );
  }
}

/** Oppdaterer ai_experiment_results: click for variant. */
export async function recordAiExperimentClick(
  supabase: any,
  experimentId: string,
  variant: string
): Promise<void> {
  const { data: row } = await supabase
    .from("ai_experiment_results")
    .select("clicks")
    .eq("experiment_id", experimentId)
    .eq("variant", variant)
    .maybeSingle();
  if (row && typeof row.clicks === "number") {
    await supabase
      .from("ai_experiment_results")
      .update({ clicks: row.clicks + 1 })
      .eq("experiment_id", experimentId)
      .eq("variant", variant);
  } else {
    await supabase.from("ai_experiment_results").upsert(
      { experiment_id: experimentId, variant, views: 0, clicks: 1, conversions: 0 },
      { onConflict: "experiment_id,variant" }
    );
  }
}

/** Oppdaterer ai_experiment_results: conversion for variant. */
export async function recordAiExperimentConversion(
  supabase: any,
  experimentId: string,
  variant: string
): Promise<void> {
  const { data: row } = await supabase
    .from("ai_experiment_results")
    .select("conversions")
    .eq("experiment_id", experimentId)
    .eq("variant", variant)
    .maybeSingle();
  if (row && typeof row.conversions === "number") {
    await supabase
      .from("ai_experiment_results")
      .update({ conversions: row.conversions + 1 })
      .eq("experiment_id", experimentId)
      .eq("variant", variant);
  } else {
    await supabase.from("ai_experiment_results").upsert(
      { experiment_id: experimentId, variant, views: 0, clicks: 0, conversions: 1 },
      { onConflict: "experiment_id,variant" }
    );
  }
}

/** Henter aggregert statistikk for et eksperiment fra ai_experiment_results. */
export async function getAiExperimentStats(
  supabase: any,
  experimentId: string
): Promise<AiExperimentStats> {
  const { data: rows, error } = await supabase
    .from("ai_experiment_results")
    .select("variant, views, clicks, conversions")
    .eq("experiment_id", experimentId);
  if (error) throw new Error(error.message);
  const list = Array.isArray(rows) ? rows : [];
  let views = 0,
    clicks = 0,
    conversions = 0;
  const variants: string[] = [];
  const byVariant: AiExperimentVariantStats[] = [];
  for (const r of list) {
    if (typeof r.variant === "string") variants.push(r.variant);
    const v = typeof r.views === "number" ? r.views : 0;
    const c = typeof r.clicks === "number" ? r.clicks : 0;
    const conv = typeof r.conversions === "number" ? r.conversions : 0;
    views += v;
    clicks += c;
    conversions += conv;
    byVariant.push({
      variant: String(r.variant ?? ""),
      views: v,
      clicks: c,
      conversions: conv,
    });
  }
  return {
    experimentId,
    views,
    clicks,
    conversions,
    variants,
    byVariant,
  };
}
