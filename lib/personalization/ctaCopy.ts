import type { UserIntent } from "@/lib/ml/sequence-model";

export type { UserIntent };

/** Deterministic CTA copy — safe for client + server render paths. */
export function heroCtaForIntent(intent: UserIntent): string {
  if (intent === "high_intent") return "Bestill nå – levering i morgen";
  if (intent === "medium_intent") return "Se meny og priser";
  return "Se hvordan det fungerer";
}
