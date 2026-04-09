import type { EnrichedPipelineDeal } from "@/lib/pipeline/enrichDeal";
import type { CeoSnapshotPayload } from "@/lib/ceo/buildSnapshot";
import type { SalesOutreachQueueItem } from "@/lib/sales/outreachQueueTypes";

/**
 * Sentral tilstand for Sales Cockpit (typer + startverdier).
 * UI-state ligger i `SalesCockpitClient` (valgt deal, kø, refresh).
 */
export type CockpitSnapshotState = {
  snapshot: CeoSnapshotPayload | null;
  deals: EnrichedPipelineDeal[];
  pipelineAvailable: boolean;
};

export type CockpitAgentQueueState = {
  items: SalesOutreachQueueItem[];
  lastRunAt: number | null;
};

export function createInitialAgentQueue(): CockpitAgentQueueState {
  return { items: [], lastRunAt: null };
}

export function createCockpitSnapshotFromCeo(
  ceo: { ok: true; snapshot: CeoSnapshotPayload } | { ok: false; error: string; code?: string },
  deals: EnrichedPipelineDeal[],
  pipelineAvailable: boolean,
): CockpitSnapshotState {
  if (ceo.ok === true) {
    return { snapshot: ceo.snapshot, deals, pipelineAvailable };
  }
  return { snapshot: null, deals, pipelineAvailable };
}
