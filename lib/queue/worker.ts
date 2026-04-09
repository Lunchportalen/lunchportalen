import "server-only";

import { chaosInject } from "@/lib/chaos/inject";
import { isLeader } from "@/lib/infra/leader";
import { acquireLock, releaseLock } from "@/lib/infra/lock";
import { getNodeId } from "@/lib/infra/node";
import { getJobs, mergeJobsFromSnapshot, updateJob } from "@/lib/queue/jobs";
import { loadQueue, saveQueueSnapshot } from "@/lib/queue/persistent";
import { getNodeShard, getShard, shardTotal } from "@/lib/queue/shard";

function isChaosPayload(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "CHAOS"
  );
}

/**
 * Prosesserer køede jobber for denne nodens shard (best effort). Lås + leder + persist.
 */
export async function runWorker(
  rid: string,
): Promise<{ processed: number; failed: number; skipped?: string }> {
  const node = getNodeId();
  mergeJobsFromSnapshot(loadQueue());

  const jobsSnapshot = getJobs();
  if (!jobsSnapshot.length) {
    console.warn("[QUEUE_EMPTY]");
  }

  console.log("[DISTRIBUTED]", { node, leader: isLeader(node) });

  if (!isLeader(node)) {
    saveQueueSnapshot(getJobs());
    return { processed: 0, failed: 0, skipped: "not_leader" };
  }

  const locked = await acquireLock();
  if (!locked) {
    return { processed: 0, failed: 0, skipped: "lock_busy" };
  }

  const total = shardTotal();
  const nodeShard = getNodeShard(node, total);

  let processed = 0;
  let failed = 0;

  try {
    const jobs = getJobs();
    for (const job of jobs) {
      if (job.status !== "queued") continue;

      const shard = getShard(job.id, total);
      if (shard !== nodeShard) continue;

      try {
        updateJob(job.id, { status: "processing" });

        chaosInject(0.05, `${rid}:job:${job.id}`);

        await new Promise<void>((r) => {
          setTimeout(r, 50);
        });

        updateJob(job.id, { status: "done" });
        processed += 1;
        console.log("[JOB_DONE]", { rid, jobId: job.id, type: job.type });
      } catch (e) {
        failed += 1;
        updateJob(job.id, { status: "failed" });
        if (isChaosPayload(e)) {
          console.error("[JOB_FAILED_CHAOS]", { rid, jobId: job.id, err: e });
        } else {
          console.error("[JOB_FAILED]", { rid, jobId: job.id, err: e });
        }
      }
    }

    saveQueueSnapshot(getJobs());
    return { processed, failed };
  } finally {
    releaseLock();
  }
}
