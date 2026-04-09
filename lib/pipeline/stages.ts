export const PIPELINE_STAGES = [
  { id: "lead", name: "Lead", probability: 0.1 },
  { id: "qualified", name: "Kvalifisert", probability: 0.3 },
  { id: "proposal", name: "Tilbud sendt", probability: 0.6 },
  { id: "negotiation", name: "Forhandling", probability: 0.8 },
  { id: "won", name: "Vunnet", probability: 1 },
  { id: "lost", name: "Tapt", probability: 0 },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

const STAGE_IDS = new Set<string>(PIPELINE_STAGES.map((s) => s.id));

export function isPipelineStageId(id: string): id is PipelineStageId {
  return STAGE_IDS.has(id);
}

export function getStageById(id: string): (typeof PIPELINE_STAGES)[number] | undefined {
  return PIPELINE_STAGES.find((s) => s.id === id);
}

/** DB `status` → standard kanban-trinn når `meta.pipeline_stage` mangler. */
export function defaultStageFromStatus(status: string): PipelineStageId {
  switch (status) {
    case "contacted":
      return "qualified";
    case "meeting":
      return "proposal";
    case "closed":
      return "won";
    case "lost":
      return "lost";
    case "new":
    default:
      return "lead";
  }
}

/** Synkroniserer `status`-kolonne med kanban (legacy + rapporter). */
export function statusFromPipelineStage(stage: PipelineStageId): "new" | "contacted" | "meeting" | "closed" | "lost" {
  switch (stage) {
    case "lead":
      return "new";
    case "qualified":
      return "contacted";
    case "proposal":
    case "negotiation":
      return "meeting";
    case "won":
      return "closed";
    case "lost":
      return "lost";
    default:
      return "new";
  }
}
