import "server-only";

import { redisFetch } from "@/lib/infra/redis";

const JOBS_KEY = "lp:jobs";

export type RedisJob = {
  id: string;
  type: string;
  payload?: unknown;
  createdAt: number;
};

export async function enqueueJob(job: RedisJob): Promise<{ ok: true } | { ok: false; code: string }> {
  const payload = JSON.stringify(job);
  const r = await redisFetch("LPUSH", [JOBS_KEY, payload]);
  if (r.ok === false) {
    console.error("[REDIS_QUEUE_ENQUEUE_FAIL]", r);
    return { ok: false, code: r.code };
  }
  console.log("[DURABLE_EVENT]", { kind: "redis_enqueue", id: job.id, type: job.type });
  return { ok: true };
}

export async function dequeueJob(): Promise<RedisJob | null> {
  const r = await redisFetch("RPOP", [JOBS_KEY]);
  if (r.ok === false) {
    console.error("[REDIS_QUEUE_DEQUEUE_FAIL]", r);
    return null;
  }
  const raw = r.data;
  if (raw === null || raw === undefined) return null;
  const s = typeof raw === "string" ? raw : String(raw);
  if (!s.trim()) return null;
  try {
    const j = JSON.parse(s) as RedisJob;
    if (typeof j?.id === "string" && typeof j?.type === "string") {
      return j;
    }
  } catch (e) {
    console.error("[REDIS_QUEUE_PARSE]", e);
  }
  return null;
}
