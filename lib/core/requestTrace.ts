/**
 * Lett request-spor på tvers av lag.
 */
export function traceRequest(rid: string, route: string): void {
  console.log("[REQUEST_TRACE]", {
    rid,
    route,
    ts: Date.now(),
  });
}
