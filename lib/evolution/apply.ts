import type { Proposal } from "./types";

/**
 * Controlled apply: default is **log-only** (no file or schema changes).
 * Real refactors must go through reviewed PRs.
 */
export async function applyProposal(proposal: Proposal): Promise<boolean> {
  console.log("[EVOLUTION_APPLY]", JSON.stringify(proposal));
  return true;
}
