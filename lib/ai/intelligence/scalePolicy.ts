/**
 * STEP 5 — Policy validation for scale: caps, deduplication, cooldown (intelligence store only).
 */

import "server-only";

import type { DecisionResult } from "@/lib/ai/decisionEngine";
import { evaluatePolicy } from "@/lib/ai/policyEngine";

import type { ScaleAction } from "./scaleDecision";
import type { IntelligenceEvent } from "./types";

export const SCALE_MAX_ACTIONS = 2;
export const SCALE_COOLDOWN_MS = 10 * 60 * 1000;

export function decisionFromScaleAction(action: ScaleAction): DecisionResult {
  const decisionType = action.type === "design" ? "funnel_optimize" : "refresh_content";
  return {
    decisionType,
    recommendation: `Kontrollert skalering: ${action.type} · ${action.target}=${action.value}`,
    confidence: action.confidence,
    reason: "Mønster over terskel validert mot policy-motor (ingen blind skalering).",
    basedOn: ["intelligence.controlled_scale", action.patternType, action.id],
  };
}

/**
 * Cooldown from recent intelligence analytics rows carrying `kind: scale_action` / `scale_rollback`.
 */
export function assertScaleCooldown(
  events: readonly IntelligenceEvent[],
  nowMs: number = Date.now(),
): { ok: boolean; reason: string } {
  let last = 0;
  for (const e of events) {
    const k = e.payload?.kind;
    if (k !== "scale_action" && k !== "scale_rollback") continue;
    if (e.timestamp > last) last = e.timestamp;
  }
  if (last <= 0) return { ok: true, reason: "no_prior_scale" };
  const elapsed = nowMs - last;
  if (elapsed < SCALE_COOLDOWN_MS) {
    return {
      ok: false,
      reason: `cooldown_active_${Math.ceil((SCALE_COOLDOWN_MS - elapsed) / 1000)}s`,
    };
  }
  return { ok: true, reason: "cooldown_ok" };
}

/**
 * One action per (type+target), highest confidence first; max {@link SCALE_MAX_ACTIONS}.
 */
export function dedupeAndCapScaleActions(actions: readonly ScaleAction[], max: number = SCALE_MAX_ACTIONS): ScaleAction[] {
  const sorted = [...actions].sort((a, b) => b.confidence - a.confidence);
  const seen = new Set<string>();
  const out: ScaleAction[] = [];
  for (const a of sorted) {
    const key = `${a.type}:${a.target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
    if (out.length >= max) break;
  }
  return out;
}

export type PolicyGatedScaleAction = {
  action: ScaleAction;
  policy: ReturnType<typeof evaluatePolicy>;
};

/**
 * Attach {@link evaluatePolicy} to each action; drop disallowed (fail-closed on weird types).
 */
export function gateScaleActionsWithPolicy(actions: readonly ScaleAction[]): PolicyGatedScaleAction[] {
  return actions.map((action) => ({
    action,
    policy: evaluatePolicy(decisionFromScaleAction(action)),
  }));
}

export function filterAllowedScaleActions(gated: readonly PolicyGatedScaleAction[]): ScaleAction[] {
  return gated.filter((g) => g.policy.allowed).map((g) => g.action);
}
