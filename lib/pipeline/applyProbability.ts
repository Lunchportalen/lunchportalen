/**
 * Oppdaterer meta.probability på lead_pipeline fra empiriske trinn-sannsynligheter.
 * Respekterer manuelle overstyringer; glatter endringer; kaster aldri til kaller.
 */
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

import { computeStageProbabilities, normalizePipelineStage, type LeadPipelineLike } from "@/lib/pipeline/realProbability";

const ROUTE = "apply_lead_probability";
const MAX_LEADS = 8000;

export type UpdateLeadProbabilitiesResult = {
  ok: boolean;
  processed: number;
  skippedManual: number;
  skippedNoChange: number;
  stats?: ReturnType<typeof computeStageProbabilities>["stats"];
  error?: string;
};

function isManualProbability(meta: Record<string, unknown>): boolean {
  if (meta.probability_locked === true) return true;
  if (meta.probability_source === "manual") return true;
  return false;
}

function smooth(oldProb: number | undefined, newProb: number): number {
  if (oldProb === undefined || typeof oldProb !== "number" || !Number.isFinite(oldProb)) {
    return newProb;
  }
  return (oldProb + newProb) / 2;
}

/**
 * Leser alle leads (cap), beregner trinn-sannsynligheter, oppdaterer meta.probability
 * når ikke manuelt låst. Idempotent på samme datasett (samme rader → samme tall).
 */
export async function updateLeadProbabilities(
  supabase?: SupabaseClient,
): Promise<UpdateLeadProbabilitiesResult> {
  const client = supabase ?? (hasSupabaseAdminConfig() ? supabaseAdmin() : null);
  if (!client) {
    console.log("[PIPELINE_PROBABILITY_SKIP]", { reason: "no_client" });
    return { ok: false, processed: 0, skippedManual: 0, skippedNoChange: 0, error: "no_client" };
  }

  try {
    const ok = await verifyTable(client, "lead_pipeline", ROUTE);
    if (!ok) {
      console.log("[PIPELINE_PROBABILITY_SKIP]", { reason: "lead_pipeline_unavailable" });
      return { ok: false, processed: 0, skippedManual: 0, skippedNoChange: 0, error: "lead_pipeline_unavailable" };
    }

    const { data: leads, error: fetchErr } = await client
      .from("lead_pipeline")
      .select("id, status, meta")
      .limit(MAX_LEADS);

    if (fetchErr) {
      console.error("[PIPELINE_PROBABILITY_FETCH]", fetchErr.message);
      return { ok: false, processed: 0, skippedManual: 0, skippedNoChange: 0, error: fetchErr.message };
    }

    const rows = (Array.isArray(leads) ? leads : []) as LeadPipelineLike[];
    if (rows.length === 0) {
      console.log("[PIPELINE_PROBABILITY_SKIP]", { reason: "no_leads" });
      return { ok: true, processed: 0, skippedManual: 0, skippedNoChange: 0 };
    }

    const { probabilities, stats } = computeStageProbabilities(rows);
    console.log("[PIPELINE_PROBABILITY_COMPUTED]", {
      globalWinRate: stats.globalWinRate,
      terminalWon: stats.terminalWon,
      terminalLost: stats.terminalLost,
      probabilities,
    });

    let processed = 0;
    let skippedManual = 0;
    let skippedNoChange = 0;

    for (const lead of rows) {
      const id = typeof lead.id === "string" ? lead.id : "";
      if (!id) continue;

      const rawMeta = lead.meta;
      const meta =
        rawMeta && typeof rawMeta === "object" && !Array.isArray(rawMeta)
          ? { ...(rawMeta as Record<string, unknown>) }
          : {};

      if (isManualProbability(meta)) {
        skippedManual++;
        continue;
      }

      const stage = normalizePipelineStage(meta.pipeline_stage);
      const target = probabilities[stage] ?? 0;
      const prevRaw = meta.probability;
      const prev = typeof prevRaw === "number" && Number.isFinite(prevRaw) ? prevRaw : undefined;
      const next = smooth(prev, target);

      if (prev !== undefined && Math.abs(next - prev) < 1e-9) {
        skippedNoChange++;
        continue;
      }

      const nextMeta = {
        ...meta,
        probability: next,
        probability_source: "empirical_stage",
        probability_model: {
          v: 1,
          stage,
          target,
          smoothed: next,
          globalWinRate: stats.globalWinRate,
          terminalWon: stats.terminalWon,
          terminalLost: stats.terminalLost,
        },
      };

      const { error: upErr } = await client.from("lead_pipeline").update({ meta: nextMeta }).eq("id", id);

      if (upErr) {
        console.error("[PIPELINE_PROBABILITY_UPDATE]", id, upErr.message);
        continue;
      }
      processed++;
    }

    console.log("[PIPELINE_PROBABILITY_DONE]", {
      processed,
      skippedManual,
      skippedNoChange,
      leadCount: rows.length,
    });

    return {
      ok: true,
      processed,
      skippedManual,
      skippedNoChange,
      stats,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[PIPELINE_PROBABILITY_FATAL]", msg);
    return { ok: false, processed: 0, skippedManual: 0, skippedNoChange: 0, error: msg };
  }
}
