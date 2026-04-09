import type { Decision, ExperimentResult, Proposal } from "./types";

export function decide(proposal: Proposal, result: ExperimentResult): Decision {
  void proposal;
  if (!result.success) return "reject";
  if (result.improvement > 0.05) {
    return "apply";
  }
  return "ignore";
}
