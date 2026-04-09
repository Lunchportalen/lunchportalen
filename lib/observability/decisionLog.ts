export type DecisionLogRecord = {
  context: unknown;
  decision: unknown;
  reason: string;
  timestamp: number;
};

export function logDecision(input: Record<string, unknown> | null | undefined): DecisionLogRecord {
  const i = input ?? {};
  return {
    context: i.context,
    decision: i.decision,
    reason: typeof i.reason === "string" ? i.reason : "system",
    timestamp: Date.now(),
  };
}
