import type { AbVariantStats } from "@/lib/social/abAnalytics";
import { pickWinner } from "@/lib/social/abWinner";

export type AbScaleAction = {
  type: "scale";
  postId: string;
  message: string;
};

/**
 * Forslag om skalering per variant-gruppe (sortert gruppenøkkel for stabil rekkefølge).
 */
export function getScalingActions(groups: Record<string, AbVariantStats[]>): AbScaleAction[] {
  const actions: AbScaleAction[] = [];
  const keys = Object.keys(groups).sort((a, b) => a.localeCompare(b));

  for (const key of keys) {
    const variants = groups[key];
    const winner = pickWinner(variants);
    if (winner && winner.score > 10) {
      actions.push({
        type: "scale",
        postId: winner.id,
        message: "Dette innlegget fungerer – lag flere varianter",
      });
    }
  }

  return actions;
}
