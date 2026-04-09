import type { AutonomyModel } from "@/lib/autonomy/model";
import type { ScoredAutonomyAction } from "@/lib/autonomy/growthTypes";

/**
 * Rank possible actions by learned average outcome (higher first). Deterministic tie-break: stable sort by input order.
 */
export function predictBestAction(model: AutonomyModel, possibleActions: ScoredAutonomyAction[]): ScoredAutonomyAction[] {
  const weights = model?.weights ?? {};

  return [...possibleActions].sort((a, b) => {
    const wa = weights[a.type]?.score ?? 0;
    const wb = weights[b.type]?.score ?? 0;
    if (wb !== wa) return wb - wa;
    return 0;
  });
}
