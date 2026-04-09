import "server-only";

let REQUESTS = 0;

export function trackRequest(): void {
  REQUESTS += 1;
}

export function getMetrics(): { requests: number; ts: number } {
  return {
    requests: REQUESTS,
    ts: Date.now(),
  };
}
