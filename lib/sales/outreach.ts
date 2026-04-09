import "server-only";

import { runAI } from "@/lib/ai/run";

export type LeadLike = {
  company?: unknown;
};

/**
 * AI-assisted outreach copy — policy enforced inside {@link runAI}.
 */
export async function generateOutreach(lead: LeadLike): Promise<string> {
  const company =
    typeof lead?.company === "string" && lead.company.trim().length > 0
      ? lead.company.trim()
      : "prospect";

  return runAI(`Write concise B2B sales outreach (Norwegian, professional) for ${company}.`, "growth");
}
