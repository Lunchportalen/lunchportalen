import "server-only";

import { hubspotFetch } from "@/lib/integrations/hubspot/client";

export type CreateDealInput = {
  name: string;
  amount?: number;
};

/**
 * Creates a deal. Pipeline/stage IDs are portal-specific — set via env (fail-closed skip if missing).
 */
export async function createDeal(data: CreateDealInput) {
  const pipeline = typeof process.env.HUBSPOT_DEAL_PIPELINE_ID === "string" ? process.env.HUBSPOT_DEAL_PIPELINE_ID.trim() : "";
  const dealstage = typeof process.env.HUBSPOT_DEAL_STAGE_ID === "string" ? process.env.HUBSPOT_DEAL_STAGE_ID.trim() : "";

  if (!pipeline || !dealstage) {
    return null;
  }

  const amount = typeof data.amount === "number" && Number.isFinite(data.amount) ? data.amount : 0;

  return hubspotFetch("/crm/v3/objects/deals", {
    method: "POST",
    body: JSON.stringify({
      properties: {
        dealname: data.name,
        amount: String(amount),
        pipeline,
        dealstage,
      },
    }),
  });
}
