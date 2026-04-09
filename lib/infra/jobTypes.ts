/**
 * Async job envelope (Redis list). Versioned for forward compatibility.
 */
import { randomUUID } from "crypto";

export const JOB_QUEUE_KEY = "lp:jobs:v1" as const;

export type JobType = "send_email" | "ai_generate" | "experiment_run" | "retry_outbox";

export type JobEnvelope = {
  v: 1;
  /** Unique per queue message — idempotent processing in worker (`ensureOnce` on delivery). */
  deliveryId: string;
  type: JobType;
  /** Business-level dedupe hint (enqueue policy / logging). */
  idempotencyKey: string;
  payload: Record<string, unknown>;
  retryCount: number;
  enqueuedAt: string;
  /** Optional trace id */
  rid?: string;
};

export function createJobEnvelope(
  type: JobType,
  payload: Record<string, unknown>,
  opts?: { idempotencyKey?: string; rid?: string }
): JobEnvelope {
  return {
    v: 1,
    deliveryId: randomUUID(),
    type,
    idempotencyKey: (opts?.idempotencyKey ?? randomUUID()).trim().slice(0, 512),
    payload,
    retryCount: 0,
    enqueuedAt: new Date().toISOString(),
    rid: opts?.rid,
  };
}
