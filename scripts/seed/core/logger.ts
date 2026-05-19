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

const EMAIL_IN_MESSAGE_RE = /email(?:_hash)?=[^\s]+/gi;

/** Redact emails/UUIDs from failure messages (HV). */
export function redactFailureMessage(message: string, maxLen = 50): string {
  let out = message.replace(EMAIL_IN_MESSAGE_RE, "email=<redacted>");
  out = out.replace(UUID_RE, (uuid) => `uuid_hash=${hashId(uuid)}`);
  return out.slice(0, maxLen);
}

export type PersistedAuthFailure = {
  global_index: number;
  email_hash: string;
  status: number | null;
  message_snippet: string;
};

export function persistFailuresJsonl(failures: PersistedAuthFailure[]): string | null {
  if (failures.length === 0) return null;
  const dir = join(REPO_ROOT, "scripts", "seed", "logs");
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${rid}-failures.jsonl`);
  for (const row of failures) {
    appendFileSync(path, `${JSON.stringify(row)}\n`, "utf8");
  }
  return path;
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

export type PerfSample = {
  duration_ms: number;
};

export function percentileMs(samples: number[], p: number): number {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(sorted.length * p)));
  return sorted[idx] ?? 0;
}

export function summarizePerf(samples: number[]): {
  count: number;
  total_ms: number;
  p50_ms: number;
  p95_ms: number;
  throughput_per_sec: number;
} {
  const total = samples.reduce((a, b) => a + b, 0);
  const count = samples.length;
  const durationSec = total > 0 ? total / 1000 : 0;
  return {
    count,
    total_ms: total,
    p50_ms: percentileMs(samples, 0.5),
    p95_ms: percentileMs(samples, 0.95),
    throughput_per_sec: durationSec > 0 ? count / durationSec : 0,
  };
}

export type BatchLogger = {
  tick: (processed: number, message?: string) => void;
  finish: (message?: string) => void;
};

export type BatchLoggerOptions = {
  /** Progress milestone step in percent (1 = every 1%, 10 = every 10%). */
  stepPct?: number;
};

const BATCH_LOGGER_SCALE_THRESHOLD = 50_000;

export function resolveBatchStepPct(total: number, opts?: BatchLoggerOptions): number {
  if (opts?.stepPct !== undefined) {
    return opts.stepPct;
  }
  return total >= BATCH_LOGGER_SCALE_THRESHOLD ? 1 : 10;
}

export function createBatchLogger(
  runner: string,
  total: number,
  label = "progress",
  opts?: BatchLoggerOptions,
): BatchLogger {
  const started = Date.now();
  let lastPct = -1;
  const stepPct = resolveBatchStepPct(total, opts);
  const milestones = new Set<number>();

  for (let p = stepPct; p <= 100; p += stepPct) {
    milestones.add(p);
  }
  milestones.add(100);

  return {
    tick(processed: number, message?: string) {
      if (total <= 0) return;
      const pct = Math.min(100, Math.floor((processed / total) * 100));
      if (!milestones.has(pct) || pct === lastPct) return;
      lastPct = pct;
      logEvent(runner, {
        action: label,
        count: processed,
        duration_ms: Date.now() - started,
        ...(message !== undefined ? { message: `pct=${pct} ${message}` } : { message: `pct=${pct}` }),
      });
    },
    finish(message?: string) {
      logEvent(runner, {
        action: `${label}_complete`,
        count: total,
        duration_ms: Date.now() - started,
        ...(message !== undefined ? { message } : {}),
      });
    },
  };
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
