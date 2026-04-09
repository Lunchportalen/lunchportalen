import type { AutonomousGeneratedAction } from "@/lib/ai/autonomousGenerator";
import type { SaasState } from "@/lib/ai/saasStateEngine";
import type { SingularityActionWithScore } from "@/lib/ai/prioritizationEngine";

function scoreSaas(a: AutonomousGeneratedAction, state: SaasState): number {
  if (a == null) return 0;
  let s = 0;
  if (a.type === "experiment") s += 50;
  if (a.type === "variant") s += 40;
  if (a.type === "optimize") s += 30;
  if (state.conversion < 0.02) s += 40;
  return s;
}

/**
 * Scores and sorts actions; dedupes by `type` keeping highest score (deterministic order).
 */
export function prioritizeSaasActions(
  actions: Array<NonNullable<AutonomousGeneratedAction>>,
  state: SaasState,
): SingularityActionWithScore[] {
  const scored = actions
    .map((a) => ({ ...a, score: scoreSaas(a, state) }))
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: SingularityActionWithScore[] = [];
  for (const a of scored) {
    if (seen.has(a.type)) continue;
    seen.add(a.type);
    out.push(a);
  }
  return out;
}
