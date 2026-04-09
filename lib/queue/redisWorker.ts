import "server-only";

import { dequeueJob } from "@/lib/queue/redisQueue";

/**
 * Henter én jobb fra Redis-kø (distribuert worker).
 */
export async function runDistributedWorker(): Promise<unknown | null> {
  const job = await dequeueJob();

  if (!job) return null;

  console.log("[REDIS_JOB]", job);

  return job;
}
