export type NormalizedObservabilityEvent = {
  type: string;
  source: string;
  payload: Record<string, unknown>;
  timestamp: number;
};

export function normalizeEvent(event: Record<string, unknown> | null | undefined): NormalizedObservabilityEvent {
  const e = event ?? {};
  const payload = e.payload;
  return {
    type: typeof e.type === "string" ? e.type : "unknown",
    source: typeof e.source === "string" ? e.source : "system",
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? (payload as Record<string, unknown>) : {},
    timestamp: Date.now(),
  };
}
