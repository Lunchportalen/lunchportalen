export type ActionTraceRecord = {
  action: unknown;
  result: unknown;
  success: boolean;
  timestamp: number;
};

export function traceAction(action: unknown, result: unknown): ActionTraceRecord {
  const r =
    result && typeof result === "object" && !Array.isArray(result) ? (result as Record<string, unknown>) : {};
  return {
    action,
    result: r,
    success: Boolean(r.ok),
    timestamp: Date.now(),
  };
}
