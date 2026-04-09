import "server-only";

import type { SystemContext } from "@/lib/ai/context/systemContext";
import type { AgentDecision } from "@/lib/ai/autonomy/types";

export function runCeoAgent(ctx: SystemContext): AgentDecision[] {
  const out: AgentDecision[] = [];
  if (ctx.cms.draftPages > 0 && ctx.analytics.events24h < 150) {
    out.push({
      agent: "CEO",
      action: "strategy.finish_drafts_before_growth",
      priority: 88,
      confidence: 0.7,
      reason: `Det finnes ${ctx.cms.draftPages} kladder mens døgntrafikk er lav (${ctx.analytics.events24h}). Prioriter ferdigstillelse og kvalitet.`,
      expectedImpact: 0.12,
    });
  }
  if (ctx.experiments.running === 0 && ctx.analytics.pageViews24h > 200) {
    out.push({
      agent: "CEO",
      action: "strategy.add_controlled_experiment",
      priority: 72,
      confidence: 0.62,
      reason: "Trafikk uten aktivt eksperiment — vurder ett kontrollert forsøk på toppflate.",
      expectedImpact: 0.08,
    });
  }
  return out;
}
