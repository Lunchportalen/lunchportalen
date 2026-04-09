/**
 * Deterministisk omsetning fra pipeline-rader (kun `closed` + value_estimate).
 * (URL-attributjon ligger i {@link ./attribution.ts}.)
 */

export type PipelineRowLike = {
  status?: string | null;
  value_estimate?: number | null;
};

export function calculatePipelineClosedRevenue(pipeline: PipelineRowLike[]): number {
  const list = Array.isArray(pipeline) ? pipeline : [];
  return list
    .filter((p) => String(p.status ?? "").trim() === "closed")
    .reduce((sum, p) => sum + (Number(p.value_estimate) || 0), 0);
}
