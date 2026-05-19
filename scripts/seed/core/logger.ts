/**
 * Structured JSON logging for seed runners (no secrets).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";

/** Match canonical UUIDs in log messages for HV redaction. */
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi;

import { REPO_ROOT, STAGING_REF } from "./env.js";

export type LogLevel = "info" | "warn" | "error";

export type LogEvent = {
  timestamp: string;
  level: LogLevel;
  rid: string;
  target_ref: string;
  runner: string;
  action: string;
  table?: string;
  count?: number;
  duration_ms?: number;
  message?: string;
};

let rid = randomUUID();
let logFilePath: string | null = null;

export function initLogger(runner: string): string {
  rid = randomUUID();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = join(REPO_ROOT, "scripts", "seed", "logs");
  mkdirSync(dir, { recursive: true });
  logFilePath = join(dir, `${stamp}-${runner}.jsonl`);
  return rid;
}

export function getRid(): string {
  return rid;
}

/** Short deterministic hash for entity IDs at info-level (HV discipline). */
export function hashId(value: string): string {
  return createHash("md5").update(value).digest("hex").slice(0, 8);
}

/** e.g. company_hash=2f3f2ee9 location_hash=55450d94 */
export function formatEntityHashes(entities: Record<string, string>): string {
  return Object.entries(entities)
    .map(([key, id]) => `${key}_hash=${hashId(id)}`)
    .join(" ");
}

function debugLogEnabled(): boolean {
  const v = (process.env.DEBUG_LOG ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function sanitizeMessage(message: string): string {
  if (debugLogEnabled()) return message;
  return message.replace(UUID_RE, (uuid) => `uuid_hash=${hashId(uuid)}`);
}

export function logEvent(
  runner: string,
  partial: Omit<LogEvent, "timestamp" | "level" | "rid" | "target_ref" | "runner"> & {
    level?: LogLevel;
  },
): void {
  const event: LogEvent = {
    timestamp: new Date().toISOString(),
    level: partial.level ?? "info",
    rid,
    target_ref: STAGING_REF,
    runner,
    action: partial.action,
    ...(partial.table !== undefined ? { table: partial.table } : {}),
    ...(partial.count !== undefined ? { count: partial.count } : {}),
    ...(partial.duration_ms !== undefined ? { duration_ms: partial.duration_ms } : {}),
    ...(partial.message !== undefined ? { message: sanitizeMessage(partial.message) } : {}),
  };

  const line = JSON.stringify(event);
  // eslint-disable-next-line no-console
  console.log(line);

  if (logFilePath) {
    appendFileSync(logFilePath, `${line}\n`, "utf8");
  }
}

export async function timed<T>(
  runner: string,
  action: string,
  table: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    logEvent(runner, {
      action,
      ...(table !== undefined ? { table } : {}),
      duration_ms: Date.now() - start,
      level: "info",
    });
    return result;
  } catch (err) {
    logEvent(runner, {
      action,
      ...(table !== undefined ? { table } : {}),
      duration_ms: Date.now() - start,
      level: "error",
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
