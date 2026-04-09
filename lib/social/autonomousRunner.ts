import "server-only";

import { autonomyConfig } from "@/lib/social/autonomyConfig";
import { computeSocialAbDecisions } from "@/lib/social/abDecisionsCore";
import type { AbVariantStats } from "@/lib/social/abAnalytics";
import { executeAutonomyActions, type AutonomyPlannedAction } from "@/lib/social/autonomyExecution";
import { logAutonomy } from "@/lib/social/autonomyLog";

export type AutonomousCycleResult =
  | { ok: true; actions: AutonomyPlannedAction[] }
  | { ok: false; reason: string; actions?: AutonomyPlannedAction[] };

/**
 * Én autonom syklus: hent A/B-vinnere → velg skaleringskandidater innenfor grenser → logg → «utfør» (fail-safe).
 */
export async function runAutonomousCycle(data?: { winners?: AbVariantStats[] }): Promise<AutonomousCycleResult> {
  if (!autonomyConfig.enabled) {
    logAutonomy({ phase: "cycle_skip", reason: "disabled", envHint: "SOCIAL_AUTONOMY_ENABLED" });
    return { ok: false, reason: "disabled" };
  }

  let winners: AbVariantStats[];
  if (data?.winners && Array.isArray(data.winners)) {
    winners = data.winners;
  } else {
    const dec = await computeSocialAbDecisions();
    if (dec.ok === false) {
      logAutonomy({ phase: "cycle_fail", reason: "decisions_unavailable", error: dec.error });
      return { ok: false, reason: "decisions_unavailable" };
    }
    winners = dec.data.winners;
  }

  const cap = Math.min(autonomyConfig.maxActionsPerRun, autonomyConfig.maxPostsPerDay, winners.length);
  const picked = winners.slice(0, cap);

  const actions: AutonomyPlannedAction[] = picked.map((w) => ({
    type: "scale",
    postId: w.id,
  }));

  logAutonomy({ phase: "cycle_plan", actions, limits: { maxActionsPerRun: autonomyConfig.maxActionsPerRun, maxPostsPerDay: autonomyConfig.maxPostsPerDay } });

  await executeAutonomyActions(actions);

  logAutonomy({ phase: "cycle_done", actionCount: actions.length });

  return { ok: true, actions };
}

/** DB-drevet syklus (anbefalt fra API/cron). */
export async function runSocialAutonomyCycleFromDb(): Promise<AutonomousCycleResult> {
  return runAutonomousCycle();
}
