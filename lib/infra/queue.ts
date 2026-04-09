import { randomUUID } from "crypto";

import { getRedis } from "@/lib/infra/redis";
import type { JobEnvelope } from "@/lib/infra/jobTypes";
import { JOB_QUEUE_KEY } from "@/lib/infra/jobTypes";

function parseJobEnvelope(raw: string): JobEnvelope | null {
  try {
    const o = JSON.parse(raw) as JobEnvelope & { deliveryId?: string };
    if (!o || o.v !== 1 || !o.type || !o.idempotencyKey) return null;
    const deliveryId = typeof o.deliveryId === "string" && o.deliveryId.trim() ? o.deliveryId.trim() : randomUUID();
    const retryCount = typeof o.retryCount === "number" && Number.isFinite(o.retryCount) ? Math.max(0, o.retryCount) : 0;
    return {
      v: 1,
      deliveryId,
      type: o.type,
      idempotencyKey: o.idempotencyKey,
      payload: o.payload && typeof o.payload === "object" && !Array.isArray(o.payload) ? o.payload : {},
      retryCount,
      enqueuedAt: typeof o.enqueuedAt === "string" ? o.enqueuedAt : new Date().toISOString(),
      rid: typeof o.rid === "string" ? o.rid : undefined,
    };
  } catch {
    return null;
  }
}

/** Load shedding: refuse new jobs when backlog exceeds this (per Redis instance). */
export const MAX_QUEUE_LEN = 1000;

export type EnqueueResult = { ok: true } | { ok: false; reason: "NO_REDIS" | "SYSTEM_BUSY" | "INVALID" };

export async function queueLength(): Promise<number> {
  const r = await getRedis();
  if (!r) return 0;
  try {
    return await r.lLen(JOB_QUEUE_KEY);
  } catch {
    return 0;
  }
}

function normalizeJob(job: JobEnvelope): JobEnvelope {
  const deliveryId = typeof job.deliveryId === "string" && job.deliveryId.trim() ? job.deliveryId.trim() : randomUUID();
  return { ...job, v: 1, deliveryId };
}

export async function enqueue(job: JobEnvelope): Promise<EnqueueResult> {
  const r = await getRedis();
  if (!r) return { ok: false, reason: "NO_REDIS" };
  if (!job?.idempotencyKey || !job?.type) return { ok: false, reason: "INVALID" };

  try {
    const len = await r.lLen(JOB_QUEUE_KEY);
    if (len >= MAX_QUEUE_LEN) {
      return { ok: false, reason: "SYSTEM_BUSY" };
    }
    const payload = normalizeJob(job);
    await r.lPush(JOB_QUEUE_KEY, JSON.stringify(payload));
    return { ok: true };
  } catch (e) {
    console.error("[queue_enqueue]", e instanceof Error ? e.message : String(e));
    return { ok: false, reason: "INVALID" };
  }
}

/**
 * Blocking pop (seconds). Node workers only.
 */
export async function dequeue(timeoutSeconds = 5): Promise<JobEnvelope | null> {
  const r = await getRedis();
  if (!r) return null;
  const sec = Math.max(1, Math.min(30, Math.floor(timeoutSeconds)));
  try {
    const res = await r.brPop([JOB_QUEUE_KEY], sec);
    if (!res || typeof res !== "object") return null;
    const el = (res as { element?: string }).element;
    if (typeof el !== "string" || !el.trim()) return null;
    return parseJobEnvelope(el);
  } catch (e) {
    console.error("[queue_dequeue]", e instanceof Error ? e.message : String(e));
    return null;
  }
}

export async function reenqueueWithBackoff(job: JobEnvelope): Promise<EnqueueResult> {
  const next: JobEnvelope = {
    ...job,
    deliveryId: randomUUID(),
    retryCount: job.retryCount + 1,
    enqueuedAt: new Date().toISOString(),
  };
  return enqueue(next);
}
