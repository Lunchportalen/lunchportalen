import "server-only";

import { structuredLog } from "@/lib/core/structuredLog";

export type Job = {
  id: string;
  type: string;
  payload?: unknown;
  status: "queued" | "processing" | "done" | "failed";
  createdAt: number;
};

/** Per prosess / instans — ikke delt på tvers av horisontal skalering uten ekstern kø. */
const QUEUE: Job[] = [];

const MAX_JOBS = 500;

function instanceHint(): string {
  try {
    return `pid_${process.pid}`;
  } catch {
    return "pid_unknown";
  }
}

export function enqueue(job: Job): { ok: true } | { ok: false; reason: "QUEUE_FULL" } {
  if (QUEUE.length >= MAX_JOBS) {
    structuredLog({
      type: "queue_reject",
      source: "queue",
      rid: job.id,
      payload: { reason: "QUEUE_FULL", instance: instanceHint() },
    });
    return { ok: false, reason: "QUEUE_FULL" };
  }

  QUEUE.push(job);
  structuredLog({
    type: "job_enqueue",
    source: "queue",
    rid: job.id,
    payload: { type: job.type, status: job.status, instance: instanceHint(), depth: QUEUE.length },
  });
  return { ok: true };
}

export function getJobs(): Job[] {
  return QUEUE.map((j) => ({ ...j }));
}

export function updateJob(id: string, update: Partial<Job>): void {
  const j = QUEUE.find((x) => x.id === id);
  if (!j) {
    structuredLog({
      type: "job_update_missing",
      source: "queue",
      rid: id,
      payload: { instance: instanceHint() },
    });
    return;
  }
  Object.assign(j, update);
  structuredLog({
    type: "job_update",
    source: "queue",
    rid: id,
    payload: { status: j.status, instance: instanceHint() },
  });
}

export function queueDepth(): number {
  return QUEUE.length;
}

/**
 * Additiv merge fra disk / reconcile (hyperscale) — hopper over duplikat-id.
 */
export function mergeJobsFromSnapshot(incoming: Job[]): void {
  for (const j of incoming) {
    if (QUEUE.length >= MAX_JOBS) {
      structuredLog({
        type: "merge_skip_capacity",
        source: "queue",
        rid: j.id,
        payload: { depth: QUEUE.length, instance: instanceHint() },
      });
      break;
    }
    if (!QUEUE.find((x) => x.id === j.id)) {
      QUEUE.push({ ...j });
    }
  }
}
