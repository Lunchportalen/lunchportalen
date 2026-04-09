import { assessRisk } from "@/lib/ai/control/riskEngine";
import { validateEthics } from "@/lib/ai/control/ethicsEngine";
import { validateAction } from "@/lib/ai/control/governanceEngine";
import { isSystemEnabled } from "@/lib/ai/control/killSwitch";
import { getOverride } from "@/lib/ai/control/overrideEngine";
import { normalizeControlType } from "@/lib/ai/control/normalizeControlType";

export type ControlGateBlocked = { action: unknown; reasons: string[] };

export type ControlGateRunResult = {
  allowed: unknown[];
  blocked: ControlGateBlocked[];
};

export function applyControlGate(actions: unknown[]): ControlGateRunResult {
  if (!isSystemEnabled()) {
    return {
      allowed: [],
      blocked: actions.map((a) => ({ action: a, reasons: ["kill_switch"] })),
    };
  }

  const override = getOverride();
  const allowed: unknown[] = [];
  const blocked: ControlGateBlocked[] = [];

  for (const action of actions) {
    const reasons: string[] = [];
    const type = normalizeControlType(action);
    const act = { type };

    if (!validateAction(act)) reasons.push("governance");
    if (!validateEthics(act)) reasons.push("ethics");
    const risk = assessRisk(act);
    if (risk === "high") reasons.push("risk_high");
    if (override.disableExperiments && type === "experiment") reasons.push("override_disable_experiments");
    if (override.disableOptimization && type === "optimize") reasons.push("override_disable_optimizer");

    if (reasons.length > 0) blocked.push({ action, reasons });
    else allowed.push(action);
  }

  return { allowed, blocked };
}

export function controlGate(actions: unknown[]): unknown[] {
  return applyControlGate(actions).allowed;
}
