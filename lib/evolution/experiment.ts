import type { ExperimentResult, Proposal } from "./types";

/**
 * Safe experiment: does not read or write production source.
 * Improvement score is deterministic from proposal risk band (simulation only).
 */
export async function testProposal(proposal: Proposal): Promise<ExperimentResult> {
  const improvement =
    proposal.risk === "low" ? 0.12 : proposal.risk === "medium" ? 0.07 : 0.04;
  return {
    success: true,
    improvement,
    notes: "simulated: deterministic score from risk; no production mutation",
  };
}
