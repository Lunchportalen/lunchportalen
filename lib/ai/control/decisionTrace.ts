type DecisionTraceEntry = {
  timestamp: number;
  surface: string;
  actionType: string;
  targetId?: string | number;
  reason: string;
  confidence?: number;
  result: "executed" | "skipped";
};

const TRACE: DecisionTraceEntry[] = [];

const MAX = 100;

export function traceDecision(entry: DecisionTraceEntry) {
  TRACE.push({
    ...entry,
    timestamp: Date.now(),
  });

  if (TRACE.length > MAX) {
    TRACE.shift();
  }
}

export function getDecisionTrace() {
  return TRACE;
}
