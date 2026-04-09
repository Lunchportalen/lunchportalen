/**
 * Canonical structured observability events for critical API and AI paths.
 * Emits JSON lines via opsLog (console + optional ai_observability persist when enabled).
 */
import "server-only";

import { opsLog } from "@/lib/ops/log";

export type ObservabilityEventStatus = "start" | "success" | "failure";

export type LogEventInput = {
  type: string;
  source: string;
  userId?: string | null;
  companyId?: string | null;
  metadata?: Record<string, unknown>;
  status: ObservabilityEventStatus;
  durationMs?: number | null;
  /** Correlates with jsonOk/jsonErr `rid` where available */
  rid?: string | null;
};

const META_MAX_KEYS = 48;
const META_STRING_MAX = 512;

function truncateMetaValue(v: unknown): unknown {
  if (typeof v === "string") {
    return v.length > META_STRING_MAX ? `${v.slice(0, META_STRING_MAX)}…` : v;
  }
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    const keys = Object.keys(o);
    if (keys.length <= META_MAX_KEYS) return v;
    const out: Record<string, unknown> = {};
    for (let i = 0; i < META_MAX_KEYS; i++) {
      const k = keys[i]!;
      out[k] = o[k];
    }
    out._truncated = true;
    return out;
  }
  return v;
}

function sanitizeMetadata(meta: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!meta || typeof meta !== "object") return {};
  const out: Record<string, unknown> = {};
  let n = 0;
  for (const [k, v] of Object.entries(meta)) {
    if (n >= META_MAX_KEYS) break;
    out[k] = truncateMetaValue(v);
    n++;
  }
  return out;
}

/**
 * Single structured event — always safe (no throw into caller).
 */
export function logEvent(input: LogEventInput): void {
  try {
    opsLog("lp.observability.event", {
      type: String(input.type ?? "").trim() || "unknown",
      source: String(input.source ?? "").trim() || "unknown",
      userId: input.userId ?? null,
      companyId: input.companyId ?? null,
      metadata: sanitizeMetadata(input.metadata),
      status: input.status,
      durationMs: input.durationMs ?? null,
      rid: input.rid ?? null,
    });
  } catch {
    /* never break request path */
  }
}

/**
 * Wraps an async handler: logs start, then success/failure with duration.
 * If the result is a Response, success/failure follows response.ok.
 */
export async function observeResponse<T>(
  ev: {
    type: string;
    source: string;
    userId?: string | null;
    companyId?: string | null;
    rid?: string | null;
    metadata?: Record<string, unknown>;
  },
  fn: () => Promise<T>,
): Promise<T> {
  const t0 = Date.now();
  logEvent({
    type: ev.type,
    source: ev.source,
    userId: ev.userId,
    companyId: ev.companyId,
    rid: ev.rid,
    status: "start",
    durationMs: 0,
    metadata: ev.metadata,
  });
  try {
    const result = await fn();
    const durationMs = Date.now() - t0;
    if (result instanceof Response) {
      const httpStatus = result.status;
      // fetch Response.ok is false for 3xx; redirects are successful handler outcomes for tracing.
      const obsOk = httpStatus < 400;
      logEvent({
        type: ev.type,
        source: ev.source,
        userId: ev.userId,
        companyId: ev.companyId,
        rid: ev.rid,
        status: obsOk ? "success" : "failure",
        durationMs,
        metadata: {
          ...ev.metadata,
          httpStatus,
        },
      });
    } else {
      logEvent({
        type: ev.type,
        source: ev.source,
        userId: ev.userId,
        companyId: ev.companyId,
        rid: ev.rid,
        status: "success",
        durationMs,
        metadata: ev.metadata,
      });
    }
    return result;
  } catch (e) {
    const durationMs = Date.now() - t0;
    logEvent({
      type: ev.type,
      source: ev.source,
      userId: ev.userId,
      companyId: ev.companyId,
      rid: ev.rid,
      status: "failure",
      durationMs,
      metadata: {
        ...ev.metadata,
        error: e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500),
      },
    });
    throw e;
  }
}
