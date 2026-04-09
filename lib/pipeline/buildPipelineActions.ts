/**
 * Henter leads, prioriterer, genererer forslag, logger topp treff (best-effort).
 */
import "server-only";

import { generateActions, type PipelineActionRow } from "@/lib/pipeline/generateActions";
import { logDealPrioritized } from "@/lib/pipeline/logPipelineAi";
import { prioritizeDeals, type LeadLike, type PrioritizedLead } from "@/lib/pipeline/prioritize";
import { LEAD_PIPELINE_LIST_COLUMNS } from "@/lib/db/leadPipelineSelect";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "build_pipeline_actions";
const MAX_LEADS = 5000;
const LOG_TOP = 10;

export async function buildPipelineActionsList(
  rid: string,
  opts?: { skipLog?: boolean },
): Promise<{
  ok: boolean;
  prioritized: PrioritizedLead[];
  items: PipelineActionRow[];
  error?: string;
}> {
  if (!hasSupabaseAdminConfig()) {
    return { ok: false, prioritized: [], items: [], error: "no_admin" };
  }

  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "lead_pipeline", ROUTE);
    if (!ok) {
      return { ok: false, prioritized: [], items: [], error: "lead_pipeline_unavailable" };
    }

    const { data, error } = await admin
      .from("lead_pipeline")
      .select(LEAD_PIPELINE_LIST_COLUMNS)
      .order("created_at", { ascending: true })
      .limit(MAX_LEADS);
    if (error) {
      return { ok: false, prioritized: [], items: [], error: error.message };
    }

    const raw = Array.isArray(data) ? data : [];
    const leads: LeadLike[] = raw
      .map((r) => {
        const o = r as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : "";
        if (!id) return null;
        return { ...o, id } as LeadLike;
      })
      .filter((x): x is LeadLike => x != null);

    const prioritized = prioritizeDeals(leads);
    const items = generateActions(prioritized);

    if (!opts?.skipLog) {
      for (let i = 0; i < Math.min(LOG_TOP, prioritized.length); i++) {
        const p = prioritized[i];
        if (typeof p.id === "string") {
          void logDealPrioritized(rid, p.id, p.priority_score);
        }
      }
    }

    console.log("[PIPELINE_ACTIONS_BUILT]", { rid, leads: leads.length, items: items.length });

    return { ok: true, prioritized, items };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[buildPipelineActionsList]", msg);
    return { ok: false, prioritized: [], items: [], error: msg };
  }
}
