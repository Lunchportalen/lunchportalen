import "server-only";

import { reconcile } from "@/lib/distributed/reconcile";
import { getNodeId } from "@/lib/infra/node";
import { getJobs, mergeJobsFromSnapshot, type Job } from "@/lib/queue/jobs";
import { loadQueue, saveQueueSnapshot } from "@/lib/queue/persistent";

const INTERVAL_MS = 5000;

/**
 * Periodisk merge disk → minne + persist (én prosess via global guard).
 * Kjøres fra Node API (f.eks. worker-run), ikke fra instrumentation (webpack/fs).
 */
export function startDistributedSyncLoopOnce(): void {
  const g = globalThis as unknown as { __lp_hyperscale_sync?: ReturnType<typeof setInterval> };
  if (g.__lp_hyperscale_sync) return;

  g.__lp_hyperscale_sync = setInterval(() => {
    void (async () => {
      console.log("[SYNC] running");
      try {
        const node = getNodeId();
        console.log("[DISTRIBUTED]", { node });

        const disk = loadQueue();
        const mem = getJobs() as Job[];
        const merged = await reconcile(mem, disk);
        mergeJobsFromSnapshot(merged);
        saveQueueSnapshot(getJobs());
      } catch (e) {
        console.error("[SYNC_FAIL]", e);
      }
    })();
  }, INTERVAL_MS);
}
