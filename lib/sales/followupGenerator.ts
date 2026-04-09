/**
 * Deterministisk oppfølgingsmal (ingen LLM) — forklarbar og repeterbar.
 */
import type { PipelineActionRow } from "@/lib/pipeline/generateActions";

export function generateFollowUpMessage(action: Pick<PipelineActionRow, "company">): string {
  const company = action.company?.trim() || "deres";

  return `Hei!

Ville bare følge opp angående lunsjløsning.

Vi ser ofte at bedrifter som ${company} får bedre kontroll og mindre svinn.

Gi beskjed om det er interessant å ta en kort prat.

Mvh`;
}
