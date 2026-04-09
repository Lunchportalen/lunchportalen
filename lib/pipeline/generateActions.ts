/**
 * Kobler prioritering til konkrete forslag (ingen kjøring).
 */
import type { PipelineSuggestedAction } from "@/lib/pipeline/actionRules";
import { decideAction } from "@/lib/pipeline/actionRules";
import type { PrioritizedLead } from "@/lib/pipeline/prioritize";

export type PipelineActionRow = {
  id: string;
  leadId: string;
  company: string;
  priority_score: number;
  predicted_probability: number;
  action: PipelineSuggestedAction;
  approved: boolean;
  executed: boolean;
};

export function companyNameFromLead(lead: PrioritizedLead): string {
  const m = lead.meta;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const cn = (m as Record<string, unknown>).company_name;
    if (typeof cn === "string" && cn.trim()) return cn.trim();
  }
  return "Uten navn";
}

export function predictedProbFromLead(lead: PrioritizedLead): number {
  const m = lead.meta;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const p = (m as Record<string, unknown>).predicted_probability;
    if (typeof p === "number" && Number.isFinite(p)) return p;
  }
  return 0;
}

export function generateActions(leads: PrioritizedLead[]): PipelineActionRow[] {
  return leads.map((l) => {
    const leadId = typeof l.id === "string" ? l.id : "";
    const action = decideAction(l);
    const id = `${leadId}:${action.type}`;

    return {
      id,
      leadId,
      company: companyNameFromLead(l),
      priority_score: l.priority_score,
      predicted_probability: predictedProbFromLead(l),
      action,
      approved: false,
      executed: false,
    };
  });
}
