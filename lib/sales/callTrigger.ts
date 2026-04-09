/**
 * Kun forslag i UI — ingen auto-oppringning (compliance).
 */
import type { LeadLike } from "@/lib/pipeline/prioritize";

export type CallSuggestion = {
  type: "call";
  message: string;
};

export function suggestCall(lead: LeadLike): CallSuggestion | null {
  const meta =
    lead.meta && typeof lead.meta === "object" && !Array.isArray(lead.meta)
      ? (lead.meta as Record<string, unknown>)
      : {};
  const prob =
    typeof meta.predicted_probability === "number" && Number.isFinite(meta.predicted_probability)
      ? meta.predicted_probability
      : 0;

  if (prob > 80) {
    return {
      type: "call",
      message: "Anbefalt: ring nå",
    };
  }
  return null;
}
