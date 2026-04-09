import type { PerceptionState } from "@/lib/ai/reality/perceptionEngine";

/** Alignment levers: CMS / experiments only — transparent improvements, no deceptive framing. */
export function alignPerception(state: PerceptionState): string[] {
  const actions: string[] = [];
  if (state.clarity < 0.7) actions.push("IMPROVE_MESSAGING");
  if (state.trust < 0.6) actions.push("ADD_TRUST_SIGNALS");
  if (state.differentiation < 0.5) actions.push("STRENGTHEN_POSITIONING");
  if (state.friction > 0.4) actions.push("REDUCE_FRICTION");
  if (state.consistency < 0.7) actions.push("INCREASE_CONSISTENCY");
  return actions;
}
