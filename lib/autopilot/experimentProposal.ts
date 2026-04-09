import "server-only";

import { createHash } from "crypto";

import { buildAiActivityLogRow } from "@/lib/ai/logging/aiActivityLogRow";
import type { AutopilotExperimentProposal, AutopilotOpportunity } from "@/lib/autopilot/types";
import { verifyTable } from "@/lib/db/verifyTable";
import { hasSupabaseAdminConfig, supabaseAdmin } from "@/lib/supabase/admin";

const ROUTE = "autopilot_proposal";

function deterministicProposalId(rid: string, opportunity: AutopilotOpportunity): string {
  const h = createHash("sha256").update(`${rid}|${opportunity.type}|${opportunity.severity.toFixed(6)}`).digest("hex");
  return `ap_${h.slice(0, 24)}`;
}

export function generateExperimentProposal(
  opportunity: AutopilotOpportunity,
  rid: string,
): AutopilotExperimentProposal {
  const id = deterministicProposalId(rid, opportunity);
  const hypothesis =
    opportunity.type === "low_conversion"
      ? "Øk konvertering (målt mot ordre) — test CTA og klarhet."
      : opportunity.type === "high_bounce"
        ? "Reduser avfall (proxy) — test skannbarhet og tillit."
        : opportunity.type === "low_revenue"
          ? "Øk omsetning — test pris/prisnivå (kontrollert, kun forslag)."
          : "Bygg mer trafikk (sessions) før skalering — test distribusjon og kroker.";

  return {
    id,
    hypothesis,
    opportunity,
    version: 1,
    createdAtIso: new Date().toISOString(),
  };
}

/**
 * Persists a **proposal** only — never publishes CMS. Reversible audit via `ai_activity_log`.
 */
export async function saveExperimentProposal(
  experiment: AutopilotExperimentProposal,
  rid: string,
): Promise<{ ok: true; experimentId: string } | { ok: false; error: string }> {
  if (!hasSupabaseAdminConfig()) {
    return { ok: false, error: "supabase_unavailable" };
  }
  try {
    const admin = supabaseAdmin();
    const ok = await verifyTable(admin, "ai_activity_log", ROUTE);
    if (!ok) return { ok: false, error: "ai_activity_log_unavailable" };

    const row = buildAiActivityLogRow({
      action: "autopilot_experiment_proposal",
      metadata: {
        experimentId: experiment.id,
        hypothesis: experiment.hypothesis,
        opportunity: experiment.opportunity,
        version: experiment.version,
        createdAtIso: experiment.createdAtIso,
        rid,
        reversible: true,
      },
    });

    const { error } = await admin.from("ai_activity_log").insert({
      ...row,
      rid,
      status: "success",
    } as Record<string, unknown>);
    if (error) return { ok: false, error: error.message };
    return { ok: true, experimentId: experiment.id };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}
