/**
 * Server payload for «Closing opportunities» i Sales Cockpit.
 */
import "server-only";

import { buildPipelineActionsList } from "@/lib/pipeline/buildPipelineActions";
import { companyNameFromLead, predictedProbFromLead } from "@/lib/pipeline/generateActions";
import { generateBookingLink } from "@/lib/sales/booking";
import { buildClosingMessage } from "@/lib/sales/closingMessage";
import { suggestCall } from "@/lib/sales/callTrigger";
import { findReadyToClose } from "@/lib/sales/readyToClose";

export type ClosingOpportunityRow = {
  leadId: string;
  company: string;
  priority_score: number;
  predicted_probability: number;
  preview: string;
  bookingUrl: string;
  callSuggestion: ReturnType<typeof suggestCall>;
};

export async function loadClosingOpportunitiesPayload(rid: string): Promise<
  | { ok: true; opportunities: ClosingOpportunityRow[] }
  | { ok: false; error: string }
> {
  const built = await buildPipelineActionsList(rid, { skipLog: true });
  if (!built.ok) {
    return { ok: false, error: built.error ?? "build_failed" };
  }

  const ready = findReadyToClose(built.prioritized);
  const opportunities: ClosingOpportunityRow[] = ready.map((lead) => {
    const id = typeof lead.id === "string" ? lead.id : "";
    return {
      leadId: id,
      company: companyNameFromLead(lead),
      priority_score: lead.priority_score,
      predicted_probability: predictedProbFromLead(lead),
      preview: buildClosingMessage(lead as { id: string; meta?: Record<string, unknown> | null }),
      bookingUrl: generateBookingLink({ id }),
      callSuggestion: suggestCall(lead),
    };
  });

  return { ok: true, opportunities };
}
