import "server-only";

import fs from "fs";
import os from "os";
import path from "path";

import type { Job } from "@/lib/queue/jobs";

function queueFilePath(): string {
  const env = String(process.env.LP_QUEUE_FILE ?? "").trim();
  if (env.length > 0) return env;
  try {
    return path.join(process.cwd(), "queue.json");
  } catch {
    return path.join(os.tmpdir(), "lunchportalen-queue.json");
  }
}

const JOB_STATUSES = new Set<Job["status"]>(["queued", "processing", "done", "failed"]);

function isJobLike(x: unknown): x is Job {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.type !== "string" || typeof o.status !== "string") return false;
  if (!JOB_STATUSES.has(o.status as Job["status"])) return false;
  return true;
}

export function loadQueue(): Job[] {
  const FILE = queueFilePath();
  try {
    const data = fs.readFileSync(FILE, "utf-8");
    const parsed = JSON.parse(data) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isJobLike).map((j) => ({
      ...j,
      createdAt: typeof j.createdAt === "number" ? j.createdAt : Date.now(),
    }));
  } catch {
    return [];
  }
}

export function saveQueue(queue: Job[]): void {
  const FILE = queueFilePath();
  try {
    const dir = path.dirname(FILE);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(queue), "utf-8");
  } catch (e) {
    console.error("[QUEUE_SAVE_FAIL]", e);
  }
}

export function saveQueueSnapshot(jobs: Job[]): void {
  if (!jobs.length) {
    console.warn("[QUEUE_EMPTY]");
  }
  saveQueue(jobs.map((j) => ({ ...j })));
}
