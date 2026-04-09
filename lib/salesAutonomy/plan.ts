import type { CeoEngineRunResult } from "@/lib/ceo/run";
import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { selectLeadsForOutreach } from "@/lib/sales/selection";
import type { AutonomyPreparedAction } from "@/lib/salesAutonomy/types";

function computeRisk(deals: EnrichedPipelineDeal[]): "low" | "medium" | "high" {
  if (deals.some((d) => d.prediction?.risk === "high")) return "high";
  if (deals.some((d) => d.prediction?.risk === "medium")) return "medium";
  return "low";
}

function prepareDealsForAction(
  ceoAction: { action: string },
  allDeals: EnrichedPipelineDeal[],
  maxLeads: number,
): EnrichedPipelineDeal[] {
  const nonTerminal = allDeals.filter((d) => d.stage !== "won" && d.stage !== "lost");
  let pool: EnrichedPipelineDeal[] = [];
  if (ceoAction.action === "trigger_outreach") {
    pool = nonTerminal.filter((d) => (d.prediction?.winProbability ?? 0) > 70);
  } else if (ceoAction.action === "send_followups") {
    pool = nonTerminal.filter((d) => (typeof d.age_days === "number" ? d.age_days : 0) > 14);
  } else {
    return [];
  }
  return selectLeadsForOutreach(pool).slice(0, maxLeads);
}

export function buildPreparedActions(
  ceo: CeoEngineRunResult,
  deals: EnrichedPipelineDeal[],
  approvedIds: Set<string>,
  maxCeoActions: number,
  maxLeadsPerAction: number,
): AutonomyPreparedAction[] {
  const list = Array.isArray(ceo.actions) ? ceo.actions : [];
  const slice = list.slice(0, Math.max(0, maxCeoActions));
  const out: AutonomyPreparedAction[] = [];

  for (const a of slice) {
    const approved = approvedIds.has(a.id);
    if (a.action === "observe") {
      out.push({ id: a.id, type: "observe", approved, risk: "low", deals: [] });
      continue;
    }

    const dealsFor = prepareDealsForAction(a, Array.isArray(deals) ? deals : [], maxLeadsPerAction);
    const risk = dealsFor.length === 0 ? "low" : computeRisk(dealsFor);
    const type = a.action === "send_followups" ? "send_followups" : "trigger_outreach";

    out.push({
      id: a.id,
      type,
      approved,
      risk,
      deals: dealsFor,
    });
  }

  return out;
}
