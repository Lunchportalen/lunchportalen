import "server-only";

import { createDeal } from "@/lib/crm/pipeline";
import type { GtmLeadInput } from "@/lib/growth/leads";
import { pickBestLeads } from "@/lib/growth/lead-picker";
import { generateMessage } from "@/lib/gtm/outboundTemplates";
import { sendMessage } from "@/lib/gtm/sender";
import { attributeDeal } from "@/lib/gtm/revenueAttribution";
import { recordGtmRun } from "@/lib/gtm/stats";
import { opsLog } from "@/lib/ops/log";

/**
 * Erstatt med CRM/DB-kilde. Default: tom liste (fail-closed — ingen hallusinerte leads).
 */
export async function getLeads(): Promise<GtmLeadInput[]> {
  return [];
}

function logOutbound(payload: {
  send: Awaited<ReturnType<typeof sendMessage>>;
  attribution: ReturnType<typeof attributeDeal>;
}): void {
  opsLog("gtm_outbound_trace", payload);
}

/**
 * Orkestrering: score → velg topp → generer melding → logg send (ingen ekstern spam uten ESP).
 * Menneskelig overstyring: kall aldri uten eksplisitt godkjenning i produksjons-ESP.
 */
export async function runGrowthEngine(): Promise<{
  status: "running" | "idle";
  leadsProcessed: number;
}> {
  const leads = await getLeads();
  const best = pickBestLeads(leads, 20);
  if (best.length === 0) {
    return { status: "idle", leadsProcessed: 0 };
  }

  let processed = 0;
  let deals = 0;
  let revenue = 0;

  for (const lead of best) {
    const message = generateMessage({
      company: lead.company,
      name: lead.name,
    });
    const send = await sendMessage(message, {
      id: lead.id,
      email: lead.email,
    });
    const deal = createDeal({ id: lead.id });
    deals += 1;
    const attr = attributeDeal(deal, send.attributionRid);
    revenue += attr.value;
    logOutbound({ send, attribution: attr });
    processed += 1;
  }

  recordGtmRun({ leadsProcessed: processed, dealsCreated: deals, revenueAttributed: revenue });

  return { status: "running", leadsProcessed: processed };
}
