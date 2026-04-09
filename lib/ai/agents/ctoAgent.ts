import "server-only";

import type { SystemContext } from "@/lib/ai/context/systemContext";
import type { AgentDecision } from "@/lib/ai/autonomy/types";

export function runCtoAgent(ctx: SystemContext): AgentDecision[] {
  const out: AgentDecision[] = [];
  if (ctx.health.status === "degraded" || ctx.errors.recentCount24h > 20) {
    out.push({
      agent: "CTO",
      action: "tech.review_logs_and_health",
      priority: 95,
      confidence: 0.72,
      reason: "Systemhelse eller feilmengde tilsier manuell gjennomgang (ingen auto-kodeendring).",
      expectedImpact: 0.15,
    });
  }
  if (ctx.aiScores.contentHealthHint != null && ctx.aiScores.contentHealthHint < 0.65) {
    out.push({
      agent: "CTO",
      action: "tech.performance_content_signals",
      priority: 68,
      confidence: 0.63,
      reason: "Svake CTA/innholdssignaler kan påvirke ytelse og konvertering — analyser før endring.",
      expectedImpact: 0.07,
    });
  }
  return out;
}
