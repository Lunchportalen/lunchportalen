import type { PerceptionState } from "@/lib/ai/reality/perceptionEngine";

export function optimizeCognitiveFlow(state: PerceptionState): string[] {
  const flow: string[] = [];
  if (state.friction > 0.4) {
    flow.push("SIMPLIFY_COPY");
    flow.push("REDUCE_DECISION_POINTS");
  }
  return flow;
}
