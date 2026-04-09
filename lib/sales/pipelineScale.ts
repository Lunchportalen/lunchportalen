import "server-only";

import type { GeneratedLead } from "@/lib/sales/generator";

export type StagedLead = GeneratedLead & { stage: "contacted" };

/**
 * Deterministic pipeline tagging.
 */
export function processPipeline(leads: GeneratedLead[]): StagedLead[] {
  return leads.map((l) => ({
    ...l,
    stage: "contacted" as const,
  }));
}
