import type { ChannelIssue } from "@/lib/growth/diagnostics";

export type BudgetRecommendation =
  | {
      kind: "scale";
      channel: string;
      action: "increase_budget";
      suggestedBudget: number;
      note: string;
    }
  | {
      kind: "fix";
      channel: string;
      action: "reduce_or_fix";
      reason: string;
};

/**
 * Kun anbefalinger — ingen automatisk kjøp eller endring av plattformkonto.
 */
export function generateRecommendations(
  allocation: Record<string, number>,
  issues: ChannelIssue[],
): BudgetRecommendation[] {
  const recs: BudgetRecommendation[] = [];

  for (const [channel, budget] of Object.entries(allocation)) {
    recs.push({
      kind: "scale",
      channel,
      action: "increase_budget",
      suggestedBudget: Math.round(budget),
      note: "Forslag basert på vektet effektivitet — krever manuell godkjenning før utbetaling.",
    });
  }

  for (const issue of issues) {
    recs.push({
      kind: "fix",
      channel: issue.channel,
      action: "reduce_or_fix",
      reason: issue.problem,
    });
  }

  return recs;
}
