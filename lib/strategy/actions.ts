import type { SystemDataBundle } from "./collect";
import type { BottleneckIssue, StrategyAction } from "./types";

import { estimateImpact } from "./impact";

export function generateStrategy(issues: BottleneckIssue[], data: SystemDataBundle): StrategyAction[] {
  return issues.map((issue) => {
    const { impact, formula } = estimateImpact(issue, data);

    if (issue.stage === "click_to_lead") {
      return {
        action: "improve_landing_page",
        reason: issue.message,
        impactEstimate: impact,
        effort: "medium",
        formula,
        issueStage: issue.stage,
        severity: issue.severity,
        approvalRequired: true,
      };
    }

    if (issue.stage === "lead_to_order") {
      return {
        action: "improve_sales_sequence",
        reason: issue.message,
        impactEstimate: impact,
        effort: "low",
        formula,
        issueStage: issue.stage,
        severity: issue.severity,
        approvalRequired: true,
      };
    }

    if (issue.stage === "reliability") {
      return {
        action: "reduce_integration_errors",
        reason: issue.message,
        impactEstimate: impact,
        effort: "medium",
        formula,
        issueStage: issue.stage,
        severity: issue.severity,
        approvalRequired: true,
      };
    }

    return {
      action: "observe",
      reason: issue.message,
      impactEstimate: 0,
      effort: "low",
      formula: "Ingen anbefalt handling — fortsett observasjon.",
      issueStage: "unknown",
      severity: issue.severity,
      approvalRequired: true,
    };
  });
}
