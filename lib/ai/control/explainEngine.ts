import { normalizeControlType } from "@/lib/ai/control/normalizeControlType";

export type ControlExplanation = {
  action: string;
  reason: string;
  state: unknown;
  timestamp: number;
};

export function explainControlDecision(action: unknown, state: unknown, nowMs: number = Date.now()): ControlExplanation {
  return {
    action: normalizeControlType(action) || "unknown",
    reason: "Triggered by system conditions (gated, auditable, reversible tooling only).",
    state,
    timestamp: nowMs,
  };
}
