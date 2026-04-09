import "server-only";

import type { SystemContext } from "@/lib/ai/context/systemContext";
import type { AgentDecision } from "@/lib/ai/autonomy/types";

export function runCmoAgent(ctx: SystemContext): AgentDecision[] {
  const out: AgentDecision[] = [];
  const pv = ctx.analytics.pageViews24h;
  const cta = ctx.analytics.ctaClicks24h;
  if (pv > 80 && cta / Math.max(pv, 1) < 0.015) {
    out.push({
      agent: "CMO",
      action: "marketing.cta_and_meta_pass",
      priority: 85,
      confidence: 0.68,
      reason: "Lav CTR på CTA relativt til sidevisninger — gjennomgå titler, meta og primær CTA.",
      expectedImpact: 0.1,
    });
  }
  if (pv < 60 && ctx.cms.draftPages === 0) {
    out.push({
      agent: "CMO",
      action: "marketing.seo_content_depth",
      priority: 70,
      confidence: 0.61,
      reason: "Lav organisk signal siste døgn — vurder innhold/SEO-tiltak på bærende sider.",
      expectedImpact: 0.09,
    });
  }
  return out;
}
