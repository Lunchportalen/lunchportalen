/**
 * Content experiments repo — list, create, get, update. Server-only.
 */

import type { ContentExperimentRow, ContentExperimentInsert, ContentExperimentUpdate } from "./model";
import { newExperimentId } from "./model";

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function listExperiments(
  supabase: any,
  opts?: { pageId?: string; status?: string }
): Promise<ContentExperimentRow[]> {
  let q = supabase.from("content_experiments").select("*").order("created_at", { ascending: false });
  if (opts?.pageId) q = q.eq("page_id", opts.pageId);
  if (opts?.status) q = q.eq("status", opts.status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as ContentExperimentRow[];
}

export async function getExperimentById(supabase: any, id: string): Promise<ContentExperimentRow | null> {
  const { data, error } = await supabase.from("content_experiments").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ContentExperimentRow | null;
}

export async function getExperimentByExperimentId(supabase: any, experimentId: string): Promise<ContentExperimentRow | null> {
  const { data, error } = await supabase.from("content_experiments").select("*").eq("experiment_id", experimentId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ContentExperimentRow | null;
}

export async function createExperiment(
  supabase: any,
  params: Omit<ContentExperimentInsert, "experiment_id"> & { experiment_id?: string }
): Promise<ContentExperimentRow> {
  const experiment_id = params.experiment_id ?? newExperimentId();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("content_experiments")
    .insert({
      page_id: params.page_id,
      variant_id: params.variant_id ?? null,
      name: params.name,
      type: params.type,
      status: params.status ?? "draft",
      experiment_id,
      config: params.config ?? {},
      created_by: params.created_by ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ContentExperimentRow;
}

export async function updateExperiment(
  supabase: any,
  id: string,
  update: ContentExperimentUpdate
): Promise<ContentExperimentRow> {
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = { ...update, updated_at: now };
  const { data, error } = await supabase
    .from("content_experiments")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as ContentExperimentRow;
}
