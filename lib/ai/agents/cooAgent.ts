import "server-only";

import type { SystemContext } from "@/lib/ai/context/systemContext";
import type { AgentDecision } from "@/lib/ai/autonomy/types";

export function runCooAgent(ctx: SystemContext): AgentDecision[] {
  const out: AgentDecision[] = [];
  if (ctx.analytics.events24h > 400) {
    out.push({
      agent: "COO",
      action: "ops.review_fulfillment_signals",
      priority: 65,
      confidence: 0.6,
      reason: "Høy aktivitet siste døgn — sjekk kapasitet og operasjonell flyt (kun observasjon her).",
      expectedImpact: 0.05,
    });
  }
  return out;
}
