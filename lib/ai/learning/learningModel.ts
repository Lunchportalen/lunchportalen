export type LearningRecord = {
  actionType: string;
  context: Record<string, unknown>;
  result: {
    conversion?: number;
    revenue?: number;
    success?: boolean;
  };
  score: number;
  timestamp: number;
};

export type BuildLearningRecordInput = {
  actionType: string;
  context?: Record<string, unknown>;
  result?: LearningRecord["result"];
};

export function buildLearningRecord(input: BuildLearningRecordInput): LearningRecord {
  return {
    actionType: input.actionType,
    context: input.context ?? {},
    result: input.result ?? {},
    score: calculateScore(input.result),
    timestamp: Date.now(),
  };
}

function calculateScore(result: LearningRecord["result"] | undefined): number {
  let score = 0;
  if (result?.conversion != null && Number.isFinite(Number(result.conversion))) {
    score += Number(result.conversion) * 100;
  }
  if (result?.revenue != null && Number.isFinite(Number(result.revenue))) {
    score += Number(result.revenue) / 100;
  }
  if (result?.success === true) score += 50;
  return score;
}
