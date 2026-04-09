import "server-only";

import { canExecuteAutonomy } from "@/lib/ai/autonomy/autonomyPolicy";
import { insertAutonomyLog } from "@/lib/ai/autonomy/autonomyLog";
import type { AutonomyExecutionRecord, AutonomyPolicyContext, MappedAutonomyAction } from "@/lib/ai/autonomy/types";
import { mapDecisionToAction } from "@/lib/ai/actions/mapDecisionToAction";
import type { MergedAutonomyDecision } from "@/lib/ai/autonomy/types";
import { opsLog } from "@/lib/ops/log";

const MAX_ACTIONS = 2;

export type ExecuteAutonomyInput = {
  rid: string;
  merged: MergedAutonomyDecision[];
  ctx: AutonomyPolicyContext;
};

/**
 * Policy-gated, log-only automation (max 2 per cycle). No DB overwrite, no publish, no code changes.
 */
export async function execute(input: ExecuteAutonomyInput): Promise<AutonomyExecutionRecord[]> {
  const out: AutonomyExecutionRecord[] = [];
  const mapped: MappedAutonomyAction[] = input.merged.map(mapDecisionToAction);

  let n = 0;
  for (const m of mapped) {
    if (n >= MAX_ACTIONS) break;

    const gate = canExecuteAutonomy(m, input.ctx);
    if (!gate.ok) {
      await insertAutonomyLog({
        rid: input.rid,
        entry_type: "autonomy_skipped",
        actor_user_id: input.ctx.userId,
        company_id: input.ctx.companyId,
        payload: {
          decisionId: m.id,
          kind: m.kind,
          reason: gate.reason,
          phase: "policy",
        },
      });
      out.push({ decisionId: m.id, ok: false, detail: gate.reason });
      opsLog("autonomy.skipped", { rid: input.rid, decisionId: m.id, reason: gate.reason });
      continue;
    }

    await insertAutonomyLog({
      rid: input.rid,
      entry_type: "autonomy_executed_safe",
      actor_user_id: input.ctx.userId,
      company_id: input.ctx.companyId,
      payload: {
        decisionId: m.id,
        kind: m.kind,
        routeHint: m.routeHint,
        label: m.label,
        detail: "no_mutation_logged",
        phase: "controlled_layer",
      },
    });
    out.push({ decisionId: m.id, ok: true, detail: "logged_safe" });
    opsLog("autonomy.executed_safe", { rid: input.rid, decisionId: m.id });
    n++;
  }

  return out;
}
