/**
 * Autonom forretningsmotor — tak, policy, prioritet, logging.
 */

import "server-only";

import { logAiExecution } from "@/lib/ai/logging/aiExecutionLog";
import { executeAction } from "@/lib/autonomy/executor";
import { explainDecision } from "@/lib/autonomy/explain";
import { generateActions } from "@/lib/autonomy/generateActions";
import type { ResolvedAutonomyPolicy } from "@/lib/autonomy/policy";
import { prioritizeActions } from "@/lib/autonomy/priorities";
import { enforceGlobalCaps } from "@/lib/autonomy/protection";
import type { AutonomousActionType } from "@/lib/autonomy/types";
import type { AutonomousRunMode, AutonomousRunResult, BusinessContext } from "@/lib/autonomy/types";
import { validateAction } from "@/lib/autonomy/validator";

function validationContextFromAction(ctx: BusinessContext, actionType: AutonomousActionType) {
  return {
    dailySpend: ctx.dailySpend,
    proposedPriceDeltaPct: actionType === "pricing_adjust" ? 0.05 : undefined,
    proposedProcurementCost: actionType === "procurement_suggest" ? 4000 : undefined,
  };
}

export async function runAutonomousBusiness(
  context: BusinessContext,
  policy: ResolvedAutonomyPolicy,
  mode: AutonomousRunMode,
  options?: { actorUserId?: string | null },
): Promise<AutonomousRunResult> {
  const emptyExplain: AutonomousRunResult["explain"] = [];
  const blocked: AutonomousRunResult["blocked"] = [];
  const executed: AutonomousRunResult["executed"] = [];

  try {
    const capState = enforceGlobalCaps(
      {
        totalSpend: context.totalSpend,
        roas: context.roas,
        margin: context.margin,
      },
      policy,
    );

    const raw = generateActions(context);
    const ordered = prioritizeActions(raw);

    let count = 0;
    for (const action of ordered) {
      if (count >= policy.maxActionsPerDay) {
        if (mode === "dry_run") {
          executed.push({
            actionType: action.type,
            status: "would_block",
            reason: "max_actions_per_day",
            message: "Ville stoppes: maks antall handlinger per dag.",
          });
          count += 1;
        } else {
          blocked.push({ actionType: action.type, reason: "max_actions_per_day" });
        }
        continue;
      }

      if (mode === "live" && action.riskLevel === "high") {
        blocked.push({ actionType: action.type, reason: "risk_too_high" });
        continue;
      }
      if (mode === "dry_run" && action.riskLevel === "high") {
        executed.push({
          actionType: action.type,
          status: "would_block",
          reason: "risk_too_high",
          message: "Live-modus ville hoppet over: risiko for høy.",
        });
        count += 1;
        continue;
      }

      if (capState === "freeze_ads" && action.type === "ads_adjust") {
        if (mode === "dry_run") {
          executed.push({
            actionType: action.type,
            status: "would_block",
            reason: "cap_freeze_ads",
            message: "Ville stoppes: total spend over tak (freeze annonser).",
          });
          count += 1;
        } else {
          blocked.push({ actionType: action.type, reason: "cap_freeze_ads" });
        }
        continue;
      }
      if (capState === "stop_scaling" && action.type === "ads_adjust") {
        if (mode === "dry_run") {
          executed.push({
            actionType: action.type,
            status: "would_block",
            reason: "cap_stop_scaling",
            message: "Ville stoppes: ROAS/margin under minimum — ingen skalering.",
          });
          count += 1;
        } else {
          blocked.push({ actionType: action.type, reason: "cap_stop_scaling" });
        }
        continue;
      }

      const vctx = validationContextFromAction(context, action.type);
      const passesPolicy = validateAction(action, vctx, policy);

      if (mode === "dry_run") {
        if (!passesPolicy) {
          executed.push({
            actionType: action.type,
            status: "would_block",
            reason: "policy_validation_failed",
            message: "Ville ikke passert policy (master av eller delbryter / tak).",
          });
        } else {
          executed.push(await executeAction(action, "dry_run", policy));
        }
        count += 1;
        continue;
      }

      if (!passesPolicy) {
        blocked.push({ actionType: action.type, reason: "policy_validation_failed" });
        continue;
      }

      const result = await executeAction(action, mode, policy);
      executed.push(result);
      count += 1;
    }

    const explain = ordered.map((a) => ({
      actionType: a.type,
      ...explainDecision(a),
    }));

    void logAiExecution({
      capability: "autonomous_business_run",
      resultStatus: "success",
      userId: options?.actorUserId ?? null,
      metadata: {
        domain: "autonomy",
        mode,
        capState,
        policyEnabled: policy.enabled,
        actionsGenerated: raw.length,
        executed: executed.map((e) => ({ type: e.actionType, status: e.status, reason: e.reason ?? null })),
        blocked,
        note: "Reversibel: ingen persistert auto-endring uten fremtidig executor.",
      },
    });

    return {
      mode,
      capState,
      policyEnabled: policy.enabled,
      actionsGenerated: raw.length,
      executed,
      blocked,
      explain,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    void logAiExecution({
      capability: "autonomous_business_run",
      resultStatus: "failure",
      userId: options?.actorUserId ?? null,
      metadata: { domain: "autonomy", mode, error: msg },
    });
    return {
      mode,
      capState: "ok",
      policyEnabled: policy.enabled,
      actionsGenerated: 0,
      executed: [],
      blocked: [{ actionType: "ads_adjust", reason: `engine_error:${msg}` }],
      explain: emptyExplain,
    };
  }
}

export async function simulateAutonomousRun(
  context: BusinessContext,
  policy: ResolvedAutonomyPolicy,
  options?: { actorUserId?: string | null },
): Promise<AutonomousRunResult> {
  return runAutonomousBusiness(context, policy, "dry_run", options);
}
