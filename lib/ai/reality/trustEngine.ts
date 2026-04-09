import type { PerceptionState } from "@/lib/ai/reality/perceptionEngine";

/**
 * Trust reinforcement suggestions (audit). Execution maps to draft content / experiments only —
 * real testimonials and case studies must be authored and truthful; system never fabricates them.
 */
export function reinforceTrust(state: PerceptionState): string[] {
  const trustActions: string[] = [];
  if (state.trust < 0.6) {
    trustActions.push("ADD_TESTIMONIALS");
    trustActions.push("ADD_CASE_STUDIES");
  }
  return trustActions;
}
