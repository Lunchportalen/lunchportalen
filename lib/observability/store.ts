import "server-only";

/**
 * Process-local request metrics (additive, in-memory).
 * Bounded latency ring buffer — deterministic, no unbounded growth.
 */
const MAX_LAT_SAMPLES = 5000;

const latencyRing: number[] = [];

let requests = 0;
let errors = 0;
let revenue = 0;

function avgLatencyMs(): number {
  if (latencyRing.length === 0) return 0;
  let s = 0;
  for (const n of latencyRing) s += n;
  return s / latencyRing.length;
}

/**
 * @param durationMs wall time for the instrumented handler (ms)
 */
export function recordRequest(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  requests += 1;
  if (latencyRing.length >= MAX_LAT_SAMPLES) latencyRing.shift();
  latencyRing.push(durationMs);
}

export function recordError(): void {
  errors += 1;
}

export function recordRevenue(amount: number): void {
  if (!Number.isFinite(amount)) return;
  revenue += amount;
}

export type ProcessMetricsSnapshot = {
  requests: number;
  errors: number;
  revenue: number;
  avgLatencyMs: number;
  latencySamples: number;
};

export function getMetrics(): ProcessMetricsSnapshot {
  return {
    requests,
    errors,
    revenue,
    avgLatencyMs: avgLatencyMs(),
    latencySamples: latencyRing.length,
  };
}

export type ProcessHealthSnapshot = {
  errorRate: number;
  avgLatency: number;
};

export function getHealthSnapshot(): ProcessHealthSnapshot {
  const m = getMetrics();
  return {
    errorRate: m.requests === 0 ? 0 : m.errors / m.requests,
    avgLatency: m.avgLatencyMs,
  };
}
