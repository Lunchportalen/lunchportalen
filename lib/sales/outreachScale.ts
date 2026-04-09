import "server-only";

import { runAI } from "@/lib/ai/run";

import type { GeneratedLead } from "@/lib/sales/generator";

export type OutreachRow = { lead: GeneratedLead; msg: string };

/**
 * Sequential outreach generation — `maxOutreach` caps cost/latency (fail-closed default).
 */
export async function runOutreach(leads: GeneratedLead[], opts?: { maxOutreach?: number }): Promise<OutreachRow[]> {
  const max = Math.min(Math.max(opts?.maxOutreach ?? 10, 1), 20);
  const slice = leads.slice(0, max);
  const results: OutreachRow[] = [];

  for (const lead of slice) {
    const msg = await runAI(`Write concise B2B outreach (Norwegian) for ${lead.company} (size ~${lead.size}).`, "growth");
    results.push({ lead, msg });
  }

  console.log("[EXECUTION]", { stage: "sales", outreachRows: results.length, leadTotal: leads.length });

  return results;
}
