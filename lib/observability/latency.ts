import "server-only";

const LATENCY: Record<string, number[]> = {};

const MAX_SAMPLES_PER_ROUTE = 50;

export function recordLatency(route: string, ms: number): void {
  const key = String(route ?? "").trim() || "/";
  if (!LATENCY[key]) LATENCY[key] = [];

  LATENCY[key].push(ms);

  if (LATENCY[key].length > MAX_SAMPLES_PER_ROUTE) {
    LATENCY[key].shift();
  }
}

export function getLatencyStats(route: string): { avg: number; samples: number } {
  const data = LATENCY[String(route ?? "").trim()] || [];

  if (!data.length) return { avg: 0, samples: 0 };

  const avg = data.reduce((a, b) => a + b, 0) / data.length;

  return { avg, samples: data.length };
}

/**
 * Aggregerer siste målinger for alle ruter som starter med prefix (f.eks. "/api").
 */
export function getLatencyStatsForPrefix(prefix: string): {
  avg: number;
  samples: number;
  routeCount: number;
} {
  const p = String(prefix ?? "").trim();
  const keys = Object.keys(LATENCY).filter((k) => (p ? k.startsWith(p) : false));
  const data: number[] = [];
  for (const k of keys) {
    const arr = LATENCY[k];
    if (Array.isArray(arr)) data.push(...arr);
  }
  if (!data.length) return { avg: 0, samples: 0, routeCount: 0 };
  const avg = data.reduce((a, b) => a + b, 0) / data.length;
  return { avg, samples: data.length, routeCount: keys.length };
}

export function listRecordedRoutes(): string[] {
  return Object.keys(LATENCY).sort();
}
