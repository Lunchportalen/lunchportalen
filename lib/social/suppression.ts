/**
 * Undertrykk svake poster (deprioriter — reversibel flagg på kalenderpost).
 */

import type { CalendarPost } from "@/lib/social/calendar";
import type { ReinforcementProposal } from "@/lib/social/scaling";

export function suppressLoser(post: CalendarPost): ReinforcementProposal[] {
  return [
    {
      type: "deprioritize",
      reason: "Low performance",
      confidence: 0.8,
      data: { postId: post.id, reinforcement: true, reinforcementKind: "suppress_loser" },
    },
  ];
}
