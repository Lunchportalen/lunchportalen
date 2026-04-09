import "server-only";

import { detectAnomaliesAndLog } from "@/lib/ai/anomaly";
import { evaluateAutonomyEventTriggers } from "@/lib/ai/events/triggers";
import { loadSystemContext } from "@/lib/ai/context/systemContext";
import { collectDecisions } from "@/lib/ai/autonomy/collectDecisions";
import { execute } from "@/lib/ai/autonomy/automationLayer";
import { insertAutonomyLog, getLastAutonomyCycleTime } from "@/lib/ai/autonomy/autonomyLog";
import { updateWeights } from "@/lib/ai/autonomy/autonomyLearning";
import { mapDecisionToAction } from "@/lib/ai/actions/mapDecisionToAction";
import type { AutonomyExecutionRecord, MergedAutonomyDecision } from "@/lib/ai/autonomy/types";
import { opsLog } from "@/lib/ops/log";

const HOUR_MS = 60 * 60 * 1000;

export type RunAutonomousCycleInput = {
  rid: string;
  actor_user_id?: string | null;
  company_id?: string | null;
  role?: string | null;
  force?: boolean;
  /** When true, skip 60m rate limit if event triggers fire. */
  eventDriven?: boolean;
};

export type RunAutonomousCycleResult = {
  rid: string;
  skipped: boolean;
  skipReason?: string;
  contextRid: string;
  decisions: MergedAutonomyDecision[];
  executed: AutonomyExecutionRecord[];
  learning: Awaited<ReturnType<typeof updateWeights>>;
  eventReasons: string[];
};

export async function runAutonomousCycle(input: RunAutonomousCycleInput): Promise<RunAutonomousCycleResult> {
  const rid = input.rid;
  const ctx = await loadSystemContext(rid);
  const anomaly = await detectAnomaliesAndLog(rid, ctx);
  const triggers = evaluateAutonomyEventTriggers(anomaly);

  if (!input.force) {
    const last = await getLastAutonomyCycleTime();
    if (last) {
      const t = new Date(last).getTime();
      const withinHour = Number.isFinite(t) && Date.now() - t < HOUR_MS;
      if (withinHour && !(input.eventDriven && triggers.shouldRun)) {
        await insertAutonomyLog({
          rid,
          entry_type: "autonomy_cycle_skipped",
          actor_user_id: input.actor_user_id ?? null,
          company_id: input.company_id ?? null,
          payload: { reason: "rate_limit_60m", last, eventReasons: triggers.reasons },
        });
        return {
          rid,
          skipped: true,
          skipReason: "rate_limit_60m",
          contextRid: ctx.rid,
          decisions: [],
          executed: [],
          learning: await updateWeights(),
          eventReasons: triggers.reasons,
        };
      }
    }
  }

  const decisions = collectDecisions(ctx);
  await insertAutonomyLog({
    rid,
    entry_type: "autonomy_decisions",
    actor_user_id: input.actor_user_id ?? null,
    company_id: input.company_id ?? null,
    payload: { decisions, triggers: triggers.reasons, anomaly },
  });

  const mappedPreview = decisions.map(mapDecisionToAction);
  await insertAutonomyLog({
    rid,
    entry_type: "autonomy_actions_planned",
    actor_user_id: input.actor_user_id ?? null,
    company_id: input.company_id ?? null,
    payload: { actions: mappedPreview },
  });

  const executed = await execute({
    rid,
    merged: decisions,
    ctx: {
      role: input.role ?? "superadmin",
      userId: input.actor_user_id ?? null,
      companyId: input.company_id ?? null,
      allowSystem: input.actor_user_id == null,
      manualConfirm: false,
    },
  });

  const learning = await updateWeights();
  await insertAutonomyLog({
    rid,
    entry_type: "autonomy_learning",
    actor_user_id: input.actor_user_id ?? null,
    company_id: input.company_id ?? null,
    payload: learning,
  });

  await insertAutonomyLog({
    rid,
    entry_type: "autonomy_cycle_summary",
    actor_user_id: input.actor_user_id ?? null,
    company_id: input.company_id ?? null,
    payload: {
      decisionCount: decisions.length,
      executedOk: executed.filter((e) => e.ok).length,
      skippedPolicy: executed.filter((e) => !e.ok).length,
    },
  });

  opsLog("autonomy.cycle_complete", {
    rid,
    decisionCount: decisions.length,
    executedOk: executed.filter((e) => e.ok).length,
  });

  return {
    rid,
    skipped: false,
    contextRid: ctx.rid,
    decisions,
    executed,
    learning,
    eventReasons: triggers.reasons,
  };
}
