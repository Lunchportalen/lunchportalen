import "server-only";

import type { NextRequest } from "next/server";

import { logTraceSpanEnd, logTraceSpanStart } from "@/lib/observability/trace";
import { recordError, recordRequest } from "@/lib/observability/store";

export type InstrumentedRouteOpts = {
  rid: string;
  /** Logical route e.g. `/api/contact` (for logs only). */
  route: string;
};

/**
 * End-to-end trace + latency sample + error count (5xx only).
 * Does not replace DB-backed graph metrics — additive process observability.
 */
export async function runInstrumentedApi(
  req: NextRequest,
  opts: InstrumentedRouteOpts,
  fn: () => Promise<Response>
): Promise<Response> {
  const { rid, route } = opts;
  logTraceSpanStart(rid, route);
  const t0 = Date.now();
  try {
    const res = await fn();
    const ms = Date.now() - t0;
    recordRequest(ms);
    if (res.status >= 500) recordError();
    return res;
  } catch (e) {
    recordError();
    throw e;
  } finally {
    logTraceSpanEnd(rid, route);
  }
}
