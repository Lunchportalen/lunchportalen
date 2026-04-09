import "server-only";

import type { SingularityGenerativeAction } from "@/lib/ai/generativeEngine";
import { opsLog } from "@/lib/ops/log";

import { getLearningByAction } from "./getLearning";

export type ActionWithLearningWeight = NonNullable<SingularityGenerativeAction> & { weight?: number };

export async function adjustActionByLearning(action: NonNullable<SingularityGenerativeAction>): Promise<ActionWithLearningWeight> {
  const actionType = String(action?.type ?? "").trim();
  if (!actionType) return action;

  try {
    const history = await getLearningByAction(actionType);
    if (!history.length) {
      opsLog("learning_priority_skip", { actionType, reason: "no_history" });
      return action;
    }

    const avgScore =
      history.reduce((sum, h) => {
        const s = h.payload?.score;
        return sum + (typeof s === "number" && Number.isFinite(s) ? s : 0);
      }, 0) / history.length;

    if (avgScore < 20) {
      const out = { ...action, weight: 0.5 };
      opsLog("learning_priority_adjust", {
        actionType,
        historyCount: history.length,
        avgScore,
        weight: out.weight,
        direction: "reduce",
      });
      return out;
    }
    if (avgScore > 80) {
      const out = { ...action, weight: 1.5 };
      opsLog("learning_priority_adjust", {
        actionType,
        historyCount: history.length,
        avgScore,
        weight: out.weight,
        direction: "boost",
      });
      return out;
    }

    opsLog("learning_priority_neutral", { actionType, historyCount: history.length, avgScore });
    return action;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    opsLog("learning_adjust_failed", { actionType, error: message });
    return action;
  }
}
