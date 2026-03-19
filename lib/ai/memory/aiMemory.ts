/**
 * AI MEMORY SYSTEM
 * AI må lære over tid. Tabell: ai_memory.
 * Lagrer: eksperimentresultater, SEO-effekt, konverteringsendringer, hva som fungerer / ikke fungerer.
 * Dette gjør systemet selvforbedrende. Server-only; RLS superadmin.
 *
 * Kind + payload:
 * - experiment: resultater fra A/B eller veksteksperimenter (f.eks. winningVariantId, metric, lift, outcome).
 * - seo_learning: SEO-effekt (f.eks. keyword, before/after, trafficDelta, improved).
 * - conversion_pattern: konverteringsendringer (f.eks. funnelStep, changePercent, direction).
 * - outcome: hva som fungerer / ikke fungerer (f.eks. worked: boolean, area, description, recommendation).
 */

export type AiMemoryKind = "experiment" | "seo_learning" | "conversion_pattern" | "outcome";

export type AiMemoryRow = {
  id: string;
  kind: AiMemoryKind;
  payload: Record<string, unknown>;
  page_id: string | null;
  company_id: string | null;
  source_rid: string | null;
  created_at: string;
};

export type AiMemoryInsert = {
  kind: AiMemoryKind;
  payload: Record<string, unknown>;
  page_id?: string | null;
  company_id?: string | null;
  source_rid?: string | null;
};

export type ListAiMemoryOpts = {
  kind?: AiMemoryKind;
  pageId?: string;
  companyId?: string;
  since?: string;
  limit?: number;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function insertAiMemory(
  supabase: any,
  row: AiMemoryInsert
): Promise<AiMemoryRow> {
  const payload = {
    kind: row.kind,
    payload: row.payload ?? {},
    page_id: row.page_id ?? null,
    company_id: row.company_id ?? null,
    source_rid: row.source_rid ?? null,
  };
  const { data, error } = await supabase.from("ai_memory").insert(payload).select().single();
  if (error) throw new Error(error.message);
  return data as AiMemoryRow;
}

export async function insertAiMemoryBatch(
  supabase: any,
  rows: AiMemoryInsert[]
): Promise<AiMemoryRow[]> {
  if (rows.length === 0) return [];
  const payloads = rows.map((row) => ({
    kind: row.kind,
    payload: row.payload ?? {},
    page_id: row.page_id ?? null,
    company_id: row.company_id ?? null,
    source_rid: row.source_rid ?? null,
  }));
  const { data, error } = await supabase.from("ai_memory").insert(payloads).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as AiMemoryRow[];
}

export async function listAiMemory(
  supabase: any,
  opts?: ListAiMemoryOpts
): Promise<AiMemoryRow[]> {
  let q = supabase
    .from("ai_memory")
    .select("*")
    .order("created_at", { ascending: false });
  if (opts?.kind) q = q.eq("kind", opts.kind);
  if (opts?.pageId) q = q.eq("page_id", opts.pageId);
  if (opts?.companyId) q = q.eq("company_id", opts.companyId);
  if (opts?.since) q = q.gte("created_at", opts.since);
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));
  q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as AiMemoryRow[];
}
