import "server-only";

import { runAI } from "@/lib/ai/run";

import type { SdrLead } from "@/lib/sdr/queue";

export async function generateMessage(lead: SdrLead) {
  const input = `
Write a short outbound message.

Company: ${lead.company}
Pain: ${lead.pain}
`.trim();

  return runAI(input, "growth");
}
