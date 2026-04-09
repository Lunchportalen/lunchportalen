import "server-only";

import { INTEGRATIONS } from "@/lib/integrations/config";
import { deterministicIntegrationId } from "@/lib/integrations/deterministicId";
import { opsLog } from "@/lib/ops/log";

export type CreateLeadResult = {
  ok: boolean;
  leadId?: string;
  detail?: string;
};

/**
 * Internal lead trace (audit + deterministic id). No DB writes in this layer — reversible, explainable.
 */
export async function createLead(data: unknown, ctx: { rid: string }): Promise<CreateLeadResult> {
  if (!INTEGRATIONS.crm.enabled) {
    opsLog("crm_lead_skipped", { rid: ctx.rid, reason: "crm_disabled" });
    return { ok: false, detail: "CRM_DISABLED" };
  }

  const leadId = deterministicIntegrationId("lead", [ctx.rid, JSON.stringify(data ?? null)]);
  opsLog("crm_lead_created", { rid: ctx.rid, leadId, data });

  return { ok: true, leadId, detail: "audit_stub" };
}
