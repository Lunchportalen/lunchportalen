/**
 * Redis queue worker (Node). Run: `npm run worker:queue`
 *
 * Unngår `import "server-only"`-kjeden slik at `tsx` kan kjøre uten Next-runtime.
 * Idempotens: Redis `SET job:delivered:{deliveryId} NX` (fallback uten Redis: kjør én gang).
 */
import type { JobEnvelope } from "@/lib/infra/jobTypes";
import { dequeue, queueLength, reenqueueWithBackoff } from "@/lib/infra/queue";
import { getRedis } from "@/lib/infra/redis";

const MAX_RETRY = 3;
const DEFAULT_BRPOP_SEC = 5;
const DELIVERED_PREFIX = "job:delivered:v1:";

function envConcurrency(): number {
  const n = Number(process.env.QUEUE_CONCURRENCY);
  if (!Number.isFinite(n)) return 5;
  return Math.max(1, Math.min(32, Math.floor(n)));
}

function logLine(payload: Record<string, unknown>) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), source: "worker:queue", ...payload }));
}

async function markDeliveredOrDuplicate(job: JobEnvelope): Promise<"proceed" | "duplicate"> {
  const r = await getRedis();
  if (!r) return "proceed";
  const key = `${DELIVERED_PREFIX}${job.deliveryId}`;
  try {
    const ok = await r.set(key, "1", { NX: true, EX: 86_400 });
    if (ok === null) return "duplicate";
    return "proceed";
  } catch (e) {
    logLine({ kind: "redis_idempotency_error", message: e instanceof Error ? e.message : String(e) });
    return "proceed";
  }
}

async function clearDelivered(job: JobEnvelope): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  try {
    await r.del(`${DELIVERED_PREFIX}${job.deliveryId}`);
  } catch {
    /* ignore */
  }
}

async function runTypedJob(job: JobEnvelope): Promise<void> {
  switch (job.type) {
    case "retry_outbox": {
      const origin = String(process.env.WORKER_INTERNAL_ORIGIN ?? process.env.NEXT_PUBLIC_SITE_URL ?? "").trim();
      const secret = String(process.env.CRON_SECRET ?? "").trim();
      if (!origin || !secret) {
        logLine({ kind: "retry_outbox_skip", reason: "missing_WORKER_INTERNAL_ORIGIN_or_CRON_SECRET" });
        return;
      }
      const url = `${origin.replace(/\/$/, "")}/api/cron/outbox`;
      const res = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}` },
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`outbox_cron_http_${res.status}:${t.slice(0, 200)}`);
      }
      return;
    }
    case "send_email":
      logLine({ kind: "send_email_stub", deliveryId: job.deliveryId });
      return;
    case "ai_generate":
      logLine({ kind: "ai_generate_stub", deliveryId: job.deliveryId });
      return;
    case "experiment_run":
      logLine({ kind: "experiment_run_stub", deliveryId: job.deliveryId });
      return;
    default:
      throw new Error(`unknown_job_type:${String(job.type)}`);
  }
}

async function handleOne(job: JobEnvelope | null): Promise<void> {
  if (!job) return;

  const depth = await queueLength();
  const started = Date.now();

  const gate = await markDeliveredOrDuplicate(job);
  if (gate === "duplicate") {
    logLine({ kind: "job_duplicate", jobType: job.type, deliveryId: job.deliveryId, queueDepth: depth });
    return;
  }

  try {
    await runTypedJob(job);
    logLine({
      kind: "job_done",
      jobType: job.type,
      deliveryId: job.deliveryId,
      latencyMs: Date.now() - started,
      queueDepth: depth,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logLine({
      kind: "job_fail",
      jobType: job.type,
      deliveryId: job.deliveryId,
      error: msg,
      queueDepth: depth,
      latencyMs: Date.now() - started,
    });
    console.error("[JOB_FAIL]", job.type, msg);
    await clearDelivered(job);
    if (job.retryCount < MAX_RETRY) {
      const re = await reenqueueWithBackoff(job);
      if (re.ok === false) {
        logLine({ kind: "reenqueue_failed", deliveryId: job.deliveryId, reason: re.reason });
      }
    }
  }
}

async function workerLoop(): Promise<void> {
  for (;;) {
    try {
      const job = await dequeue(DEFAULT_BRPOP_SEC);
      await handleOne(job);
    } catch (e) {
      console.error("[worker_loop]", e instanceof Error ? e.message : String(e));
    }
  }
}

async function main() {
  const n = envConcurrency();
  logLine({ kind: "worker_start", concurrency: n, queue: "lp:jobs:v1" });
  await Promise.all(Array.from({ length: n }, () => workerLoop()));
}

void main();
