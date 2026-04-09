import "server-only";

import { heroCtaForIntent } from "@/lib/personalization/ctaCopy";
import type { UserIntent } from "@/lib/ml/sequence-model";
import { predictNextAction } from "@/lib/ml/sequence-model";

export type PersonalizablePage = {
  blocks: Array<{ type: string; [k: string]: unknown }>;
};

/**
 * Server-side page transform — caller must persist nothing without validation.
 */
export function personalizePage(userId: string, page: PersonalizablePage): PersonalizablePage {
  const intent: UserIntent = predictNextAction(userId);
  return {
    ...page,
    blocks: page.blocks.map((block) => {
      if (block.type === "hero") {
        const ctaText = heroCtaForIntent(intent);
        return { ...block, ctaText };
      }
      return block;
    }),
  };
}
