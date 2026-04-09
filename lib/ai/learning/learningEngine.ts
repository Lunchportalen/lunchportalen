import { buildAttributionInsights } from "@/lib/ai/attribution/insightEngine";

import { buildLearningRecord } from "./learningModel";
import { extractOutcome } from "./outcomeEngine";

export type ProcessLearningInput = {
  actionType: string;
  context?: Record<string, unknown>;
  result?: Record<string, unknown> | null;
};

export function processLearning(input: ProcessLearningInput) {
  const result = extractOutcome(input.result ?? undefined);
  return buildLearningRecord({
    actionType: input.actionType,
    context: input.context,
    result,
  });
}

/**
 * Feeds learning / capital callers with deterministic ROI-ranked attribution from `attribution_cycle` rows.
 */
export function attributionInsightsForRecords(records: unknown[]) {
  return buildAttributionInsights(records);
}
