import "server-only";

import { createJobEnvelope } from "@/lib/infra/jobTypes";
import { enqueue } from "@/lib/infra/queue";
import { isRedisConfigured } from "@/lib/infra/redis";

/**
 * Optional wake signal after durable outbox write (additive; cron still drains).
 * Requires `REDIS_URL` + `OUTBOX_QUEUE_FANOUT=true`.
 */
export async function fanOutOutboxInserted(eventKey: string): Promise<void> {
  if (process.env.OUTBOX_QUEUE_FANOUT !== "true") return;
  if (!isRedisConfigured()) return;

  const job = createJobEnvelope(
    "retry_outbox",
    { eventKey: String(eventKey ?? "").trim().slice(0, 500) },
    { idempotencyKey: `outbox_fanout:${eventKey}`.slice(0, 512) },
  );
  const res = await enqueue(job);
  if (res.ok === false && res.reason === "SYSTEM_BUSY") {
    console.warn("[outbox_fanout] queue busy, worker will drain via cron/outbox");
  }
}
