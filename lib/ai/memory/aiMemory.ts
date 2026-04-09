import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/types/database";

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
 * - singularity_cycle: vekst-orkestrator (context, opportunities, executed) — én rad per kjøring.
 * - god_mode_cycle: business engine (state, leaks, pricing suggestions, strategy, executed).
 * - omniscient_cycle: market simulation + ranking + expansion hints (audit only).
 * - revenue_mode_cycle: revenue intelligence + pricing sims + offers + gaps + execution trace.
 * - autonomous_cycle: SaaS state + intel + opportunities + prioritized types + executed steps.
 * - strategy_cycle: strategic context, pillars, prioritized roadmap, execution trace (≤2 steps, no pricing auto-apply).
 * - org_cycle: multi-agent org context, CEO directives, team actions, merged plan, execution trace (≤2 steps).
 * - market_cycle: market context, competitor insights, gaps, position, pricing simulations (audit), expansion, execution trace.
 * - monopoly_cycle: category mode, demand/lock-in/network/threat signals, strategy pillars, mapped actions, execution trace (≤2, no pricing/prod).
 * - reality_cycle: perception alignment strategy tokens + safe execution trace.
 * - control_decision: governance gate audit (lane, received, allowed, blocked + reasons).
 * - budget_execution: capital allocation → prioritized plan → safe execution trace (no payments).
 * - resource_allocation: resource match + capacity-safe schedule + utilization (no overload).
 * - learning_cycle: structured outcome → action learning (priority weighting only; append-only).
 * - attribution_cycle: action → event → outcome metrics for ROI / capital signals (append-only).
 * - scaling_cycle: ROI-driven scale/suppress plan + safe singularity execution trace (append-only).
 * - profit_cycle: margin / unit-economics plan + safe singularity execution trace (append-only; no payments).
 */

export type AiMemoryKind =
  | "experiment"
  | "seo_learning"
  | "conversion_pattern"
  | "outcome"
  | "singularity_cycle"
  | "god_mode_cycle"
  | "omniscient_cycle"
  | "revenue_mode_cycle"
  | "autonomous_cycle"
  | "strategy_cycle"
  | "org_cycle"
  | "market_cycle"
  | "monopoly_cycle"
  | "reality_cycle"
  | "control_decision"
  | "budget_execution"
  | "resource_allocation"
  | "learning_cycle"
  | "attribution_cycle"
  | "scaling_cycle"
  | "profit_cycle";

export type AiMemoryRow = {
  id: string;
  kind: AiMemoryKind;
  payload: Record<string, unknown>;
  page_id: string | null;
  company_id: string | null;
  source_rid: string | null;
  created_at: string;
  outcome_score?: number | null;
  success?: boolean | null;
  action_type?: string | null;
};

export type AiMemoryInsert = {
  kind: AiMemoryKind;
  payload: Record<string, unknown>;
  page_id?: string | null;
  company_id?: string | null;
  source_rid?: string | null;
  outcome_score?: number | null;
  success?: boolean | null;
  action_type?: string | null;
};

export type ListAiMemoryOpts = {
  kind?: AiMemoryKind;
  pageId?: string;
  companyId?: string;
  since?: string;
  limit?: number;
};

export async function insertAiMemory(
  supabase: SupabaseClient<Database>,
  row: AiMemoryInsert
): Promise<AiMemoryRow> {
  const kind = String(row.kind ?? "").trim();
  if (!kind) throw new Error("Missing kind");
  const insertRow: Record<string, unknown> = {
    kind,
    payload: row.payload ?? {},
    page_id: row.page_id ?? null,
    company_id: row.company_id ?? null,
    source_rid: row.source_rid ?? null,
  };
  if (row.outcome_score != null && Number.isFinite(Number(row.outcome_score))) {
    insertRow.outcome_score = Number(row.outcome_score);
  }
  if (row.success != null) insertRow.success = Boolean(row.success);
  if (row.action_type != null && String(row.action_type).trim() !== "") {
    insertRow.action_type = String(row.action_type).trim();
  }
  const { data, error } = await supabase.from("ai_memory").insert(insertRow).select().single();
  if (error) throw new Error(error.message);
  return data as AiMemoryRow;
}

export async function insertAiMemoryBatch(
  supabase: SupabaseClient<Database>,
  rows: AiMemoryInsert[]
): Promise<AiMemoryRow[]> {
  if (rows.length === 0) return [];
  const payloads = rows.map((row) => {
    const kind = String(row.kind ?? "").trim();
    if (!kind) throw new Error("Missing kind");
    const insertRow: Record<string, unknown> = {
      kind,
      payload: row.payload ?? {},
      page_id: row.page_id ?? null,
      company_id: row.company_id ?? null,
      source_rid: row.source_rid ?? null,
    };
    if (row.outcome_score != null && Number.isFinite(Number(row.outcome_score))) {
      insertRow.outcome_score = Number(row.outcome_score);
    }
    if (row.success != null) insertRow.success = Boolean(row.success);
    if (row.action_type != null && String(row.action_type).trim() !== "") {
      insertRow.action_type = String(row.action_type).trim();
    }
    return insertRow;
  });
  const { data, error } = await supabase.from("ai_memory").insert(payloads).select();
  if (error) throw new Error(error.message);
  return (data ?? []) as AiMemoryRow[];
}

export async function listAiMemory(
  supabase: SupabaseClient<Database>,
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
