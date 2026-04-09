/**
 * STEP 4 — Structured memory payloads for ai_activity_log (no silent persistence here).
 */

import type { CompanyDecision } from "./types";

export type CompanyMemoryRecord = {
  action: string;
  decisionId?: string;
  type?: CompanyDecision["type"];
  result?: string;
  metricBefore?: number | null;
  metricAfter?: number | null;
  mode?: string;
  reversible?: boolean;
};

export function buildCompanyMemoryPayload(input: {
  phase: "decision" | "execute" | "outcome" | "reject";
  decision?: CompanyDecision;
  mode?: string;
  result?: string;
  metricBefore?: number | null;
  metricAfter?: number | null;
}): CompanyMemoryRecord {
  const base: CompanyMemoryRecord = {
    action:
      input.phase === "decision"
        ? "company_layer_decision"
        : input.phase === "execute"
          ? "company_layer_execute"
          : input.phase === "reject"
            ? "company_layer_reject"
            : "company_layer_outcome",
    mode: input.mode,
    result: input.result,
    metricBefore: input.metricBefore,
    metricAfter: input.metricAfter,
    reversible: true,
  };
  if (input.decision) {
    base.decisionId = input.decision.id;
    base.type = input.decision.type;
    base.action = `${base.action}:${input.decision.id}`;
  }
  return base;
}
