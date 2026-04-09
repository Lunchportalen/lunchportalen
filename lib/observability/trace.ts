import "server-only";

export type TraceHandle = {
  name: string;
  rid: string;
  start: number;
};

export function startTrace(name: string, rid: string): TraceHandle {
  return {
    name,
    rid,
    start: Date.now(),
  };
}

export function endTrace(trace: TraceHandle): number {
  const duration = Date.now() - trace.start;

  console.log("[TRACE]", {
    name: trace.name,
    rid: trace.rid,
    duration,
  });

  return duration;
}

/** Correlation-only span markers (additive; used by `runInstrumentedApi`). */
export function logTraceSpanStart(rid: string, route?: string): void {
  if (route) {
    console.log("[TRACE_START]", rid, route);
  } else {
    console.log("[TRACE_START]", rid);
  }
}

export function logTraceSpanEnd(rid: string, route?: string): void {
  if (route) {
    console.log("[TRACE_END]", rid, route);
  } else {
    console.log("[TRACE_END]", rid);
  }
}
