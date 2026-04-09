import "server-only";

import { evaluateSystem } from "@/lib/ai/ceo/decisionEngine";
import { generateGrowthActions } from "@/lib/ai/ceo/growthEngine";
import { executeActions } from "@/lib/ai/ceo/automationEngine";
import { insertAiCeoLog, getLastCeoCycleSummaryTime } from "@/lib/ai/ceo/ceoLog";
import { updateModel } from "@/lib/ai/ceo/learning";
import type { CeoExecutionRecord } from "@/lib/ai/ceo/types";
import { opsLog } from "@/lib/ops/log";

const HOUR_MS = 60 * 60 * 1000;

export type RunCeoCycleInput = {
  rid: string;
  /** Superadmin cron: no user id — automation stays log-only */
  actor_user_id?: string | null;
  company_id?: string | null;
  role?: string | null;
  force?: boolean;
};

export type RunCeoCycleResult = {
  rid: string;
  skipped: boolean;
  skipReason?: string;
  decisions: Awaited<ReturnType<typeof evaluateSystem>>["decisions"];
  snapshot: Awaited<ReturnType<typeof evaluateSystem>>["snapshot"];
  actions: ReturnType<typeof generateGrowthActions>;
  executed: CeoExecutionRecord[];
  learning: Awaited<ReturnType<typeof updateModel>>;
};

export async function runCeoCycle(input: RunCeoCycleInput): Promise<RunCeoCycleResult> {
  const rid = input.rid;

  if (!input.force) {
    const last = await getLastCeoCycleSummaryTime();
    if (last) {
      const t = new Date(last).getTime();
      if (Number.isFinite(t) && Date.now() - t < HOUR_MS) {
        await insertAiCeoLog({
          rid,
          entry_type: "ceo_cycle_skipped",
          actor_user_id: input.actor_user_id ?? null,
          company_id: input.company_id ?? null,
          payload: { reason: "rate_limit_1h", last },
        });
        return {
          rid,
          skipped: true,
          skipReason: "rate_limit_1h",
          decisions: [],
          snapshot: {
            analyticsEvents24h: 0,
            pageViews24h: 0,
            ctaClicks24h: 0,
            runningExperiments: 0,
            draftPages: 0,
          },
          actions: [],
          executed: [],
          learning: await updateModel(),
        };
      }
    }
  }

  const { decisions, snapshot } = await evaluateSystem({ rid });
  await insertAiCeoLog({
    rid,
    entry_type: "ceo_decisions",
    actor_user_id: input.actor_user_id ?? null,
    company_id: input.company_id ?? null,
    payload: { decisions, snapshot },
  });

  const actions = generateGrowthActions(decisions);
  await insertAiCeoLog({
    rid,
    entry_type: "ceo_actions_planned",
    actor_user_id: input.actor_user_id ?? null,
    company_id: input.company_id ?? null,
    payload: { actions },
  });

  const executed = await executeActions(actions, {
    rid,
    role: input.role ?? "superadmin",
    userId: input.actor_user_id ?? null,
    companyId: input.company_id ?? null,
    allowSystem: input.actor_user_id == null,
  });

  const learning = await updateModel();
  await insertAiCeoLog({
    rid,
    entry_type: "ceo_learning",
    actor_user_id: input.actor_user_id ?? null,
    company_id: input.company_id ?? null,
    payload: learning,
  });

  await insertAiCeoLog({
    rid,
    entry_type: "ceo_cycle_summary",
    actor_user_id: input.actor_user_id ?? null,
    company_id: input.company_id ?? null,
    payload: {
      decisionCount: decisions.length,
      actionCount: actions.length,
      executedCount: executed.filter((e) => e.ok).length,
    },
  });

  opsLog("ai_ceo_controlled.cycle_complete", {
    rid,
    decisionCount: decisions.length,
    executedOk: executed.filter((e) => e.ok).length,
  });

  return {
    rid,
    skipped: false,
    decisions,
    snapshot,
    actions,
    executed,
    learning,
  };
}
