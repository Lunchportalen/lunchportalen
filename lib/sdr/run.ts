import "server-only";

import { auditLog } from "@/lib/core/audit";
import { generateMessage } from "@/lib/sdr/generate";
import { clearQueue, getQueue, type SdrLead } from "@/lib/sdr/queue";

export type SdrRunResult = { lead: SdrLead; msg: string };

/**
 * Generates drafts for queued leads, logs each, then clears the queue (idempotent per batch).
 * Does not send external mail.
 */
export async function runSDR(): Promise<SdrRunResult[]> {
  const leads = getQueue();
  clearQueue();

  const results: SdrRunResult[] = [];

  for (const lead of leads) {
    const msg = await generateMessage(lead);

    await auditLog({
      action: "sdr_generated",
      entity: "outbound",
      metadata: {
        company_preview: String(lead.company ?? "").slice(0, 120),
        pain_preview: String(lead.pain ?? "").slice(0, 200),
        msg_preview: String(msg ?? "").slice(0, 400),
        idempotencyKey: lead.idempotencyKey ?? null,
      },
    });

    results.push({ lead, msg });
  }

  return results;
}
