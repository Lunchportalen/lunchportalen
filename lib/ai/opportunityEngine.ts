import type { GlobalIntelligenceContext } from "@/lib/ai/globalIntelligence";

/**
 * Deterministic opportunity tags from context. No side effects.
 */
export function detectOpportunities(ctx: GlobalIntelligenceContext): string[] {
  const ops: string[] = [];
  if (ctx.conversion < 0.03) ops.push("OPTIMIZE_FUNNEL");
  if (ctx.traffic > 1000 && ctx.conversion < 0.02) ops.push("CREATE_VARIANT");
  if (ctx.experiments === 0) ops.push("START_EXPERIMENT");
  if (ctx.worstPages.length > 0) ops.push("FIX_LOW_PAGES");
  return ops;
}
