/**
 * Skaler vinnere: planlagt boost (samme produkt) + replisering via generate_post (basertOn).
 */

import type { CalendarPost } from "@/lib/social/calendar";

export type ReinforcementProposal = {
  type: "boost_existing" | "generate_post" | "deprioritize";
  reason: string;
  confidence: number;
  data: Record<string, unknown>;
};

/**
 * @param plannedBoostPostId planlagt post å løfte (samme produkt som vinner), eller null hvis ingen.
 */
export function scaleWinner(post: CalendarPost, plannedBoostPostId: string | null): ReinforcementProposal[] {
  const out: ReinforcementProposal[] = [];
  if (plannedBoostPostId) {
    out.push({
      type: "boost_existing",
      reason: "High performing post",
      confidence: 0.9,
      data: {
        postId: plannedBoostPostId,
        reinforcement: true,
        reinforcementKind: "scale_winner_boost",
        sourceWinnerId: post.id,
      },
    });
  }
  out.push({
    type: "generate_post",
    reason: "Replicate winning format",
    confidence: 0.85,
    data: {
      basedOn: post.id,
      productId: post.productId,
      slotDay: post.slotDay,
      reinforcement: true,
      reinforcementKind: "replicate_winner",
    },
  });
  return out;
}
