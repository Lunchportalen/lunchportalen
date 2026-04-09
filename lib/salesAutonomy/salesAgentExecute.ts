import "server-only";

import { canExecuteSalesAction } from "@/lib/salesAutonomy/salesPolicy";
import { filterDealsNotInCooldown, markDealAutonomyTouch } from "@/lib/salesAutonomy/cooldown";
import type { AutonomyPreparedAction, AutonomyResultItem, AutonomyRuntimeConfig } from "@/lib/salesAutonomy/types";
import { runSalesAgent } from "@/lib/sales/runAgent";

export async function executePreparedActions(
  prepared: AutonomyPreparedAction[],
  ctx: {
    config: AutonomyRuntimeConfig;
    idempotencyKey: string;
    actorEmail: string | null;
  },
): Promise<AutonomyResultItem[]> {
  const results: AutonomyResultItem[] = [];
  const idem = typeof ctx.idempotencyKey === "string" ? ctx.idempotencyKey.trim() : "";

  for (const action of prepared) {
    if (action.type === "observe") {
      results.push({
        id: action.id,
        type: action.type,
        status: "skipped",
        reason: "observe",
      });
      continue;
    }

    const gate = canExecuteSalesAction(action, ctx.config);
    if (gate.ok === false) {
      results.push({
        id: action.id,
        type: action.type,
        status: "blocked",
        reason: gate.reason,
      });
      continue;
    }

    const eligible = filterDealsNotInCooldown(action.deals);
    if (eligible.length === 0) {
      results.push({
        id: action.id,
        type: action.type,
        status: "skipped",
        reason: "cooldown_or_empty",
      });
      continue;
    }

    try {
      await runSalesAgent(eligible, {
        idempotencyPrefix: idem ? `${idem}:${action.id}` : action.id,
        actorEmail: ctx.actorEmail,
      });
      for (const d of eligible) {
        markDealAutonomyTouch(d.id);
      }
      results.push({
        id: action.id,
        type: action.type,
        status: "executed",
        result: "sales_agent_run",
      });
    } catch {
      results.push({
        id: action.id,
        type: action.type,
        status: "failed",
        reason: "agent_error",
      });
    }
  }

  return results;
}
