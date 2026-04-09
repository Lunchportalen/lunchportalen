import "server-only";

import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";
import { generateSalesMessage } from "@/lib/sales/messageGenerator";
import { buildOutreachQueue, type OutreachQueueItem } from "@/lib/sales/queue";
import { logSalesOutreachGenerated } from "@/lib/sales/logOutreach";
import { selectLeadsForOutreach } from "@/lib/sales/selection";

export type RunSalesAgentResult = {
  queue: OutreachQueueItem[];
  /** Valgte leads (samme rekkefølge som kø). */
  selectedLeads: EnrichedPipelineDeal[];
  /** Enkel hook for senere læring / rapportering. */
  learning: Array<{ dealId: string; winProbability: number; stage: string }>;
};

export async function runSalesAgent(
  rows: EnrichedPipelineDeal[],
  opts?: { idempotencyPrefix?: string; actorEmail?: string | null },
): Promise<RunSalesAgentResult> {
  const leads = selectLeadsForOutreach(rows);
  const messages: string[] = [];
  const idem = opts?.idempotencyPrefix?.trim() ?? "";

  for (const lead of leads) {
    const msg = await generateSalesMessage(lead);
    messages.push(msg);
    await logSalesOutreachGenerated({
      route: "runSalesAgent",
      dealId: lead.id,
      message: msg,
      actorEmail: opts?.actorEmail ?? null,
      idempotencyKey: idem || null,
    });
  }

  const queue = buildOutreachQueue(leads, messages, { idempotencyPrefix: idem || undefined });

  console.log("[SALES_AGENT]", {
    selected: leads.length,
    idempotencyPrefix: idem || null,
    queueItems: queue.length,
  });

  return {
    queue,
    selectedLeads: leads,
    learning: leads.map((l) => ({
      dealId: l.id,
      winProbability: l.prediction.winProbability,
      stage: l.stage,
    })),
  };
}
