import "server-only";

import { canExecute } from "@/lib/ai/ceo/policyEngine";
import { insertAiCeoLog } from "@/lib/ai/ceo/ceoLog";
import type { CeoExecutionRecord, CeoGrowthAction, CeoPolicyContext } from "@/lib/ai/ceo/types";
import { opsLog } from "@/lib/ops/log";

/**
 * Controlled automation: never mutates CMS, publish, or experiments here.
 * Only logs policy evaluation + safe acknowledgement rows for traceability.
 */
export async function executeActions(
  actions: CeoGrowthAction[],
  ctx: CeoPolicyContext & { rid: string },
): Promise<CeoExecutionRecord[]> {
  const out: CeoExecutionRecord[] = [];
  const max = Math.min(actions.length, 3);

  for (let i = 0; i < max; i++) {
    const a = actions[i]!;
    const gate = canExecute(a, ctx);
    if (!gate.ok) {
      await insertAiCeoLog({
        rid: ctx.rid,
        entry_type: "action_skipped",
        actor_user_id: ctx.userId,
        company_id: ctx.companyId,
        payload: {
          actionId: a.id,
          decisionType: a.decisionType,
          reason: gate.reason,
          phase: "policy",
        },
      });
      out.push({ actionId: a.id, ok: false, detail: gate.reason });
      opsLog("ai_ceo.action_skipped", { rid: ctx.rid, actionId: a.id, reason: gate.reason });
      continue;
    }

    await insertAiCeoLog({
      rid: ctx.rid,
      entry_type: "action_logged_safe",
      actor_user_id: ctx.userId,
      company_id: ctx.companyId,
      payload: {
        actionId: a.id,
        decisionType: a.decisionType,
        label: a.label,
        detail: "no_mutation_executed_requires_human",
        phase: "controlled_layer",
      },
    });
    out.push({
      actionId: a.id,
      ok: true,
      detail: "logged_safe_no_side_effects",
    });
    opsLog("ai_ceo.action_logged_safe", { rid: ctx.rid, actionId: a.id });
  }

  return out;
}
