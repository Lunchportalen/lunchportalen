import "server-only";

import { improveBlocks } from "@/lib/ai/autoImprove";
import { opsLog } from "@/lib/ops/log";
import { trackUsage } from "@/lib/saas/billingTracker";

function blockCountBefore(blocks: unknown): number {
  if (Array.isArray(blocks)) return blocks.length;
  if (blocks && typeof blocks === "object" && !Array.isArray(blocks)) {
    const b = (blocks as { blocks?: unknown }).blocks;
    if (Array.isArray(b)) return b.length;
  }
  return 0;
}

/**
 * Deterministic CMS block improvement pass (CRO/SEO rules in {@link improveBlocks}).
 */
export function optimizeBlocks(blocks: unknown) {
  const before = blockCountBefore(blocks);
  const improved = improveBlocks(blocks);
  opsLog("ai_optimizer_applied", {
    before,
    after: improved.blocks.length,
  });
  trackUsage({ kind: "ai_optimizer_applied", before, after: improved.blocks.length });
  return improved;
}
