/**
 * Parallel Auth Admin API workers with 429 backoff (B4.1+).
 */
import {
  createAuthUser,
  deleteAuthUserById,
  stagingPasswordForEmail,
  type CreateAuthUserInput,
} from "./admin-api.js";
import type { SeedEnv } from "../core/env.js";
import {
  getRid,
  hashId,
  logEvent,
  persistFailuresJsonl,
  redactFailureMessage,
  summarizePerf,
  type PersistedAuthFailure,
} from "../core/logger.js";

const RUNNER = "auth-parallel";

export type ParallelAuthUserSpec = CreateAuthUserInput & {
  globalIndex: number;
};

export type ParallelAuthSuccess = {
  globalIndex: number;
  id: string;
  email: string;
  duration_ms: number;
};

export type ParallelAuthFailure = {
  globalIndex: number;
  email: string;
  message: string;
  status?: number;
};

export type ParallelAuthResult = {
  ok: ParallelAuthSuccess[];
  failed: ParallelAuthFailure[];
  stats: {
    total: number;
    success: number;
    failed: number;
    rate_limited_429: number;
    duration_ms: number;
    throughput_per_sec: number;
    p50_ms: number;
    p95_ms: number;
  };
};

export type ParallelAuthOptions = {
  workers?: number;
  failureRateMax?: number;
  maxBackoffMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(message: string): boolean {
  const m = message.toLowerCase();
  return m.includes("429") || m.includes("rate limit") || m.includes("too many requests");
}

function parseFailureStatus(message: string, explicit?: number): number | null {
  if (explicit === 429) return 429;
  const statusMatch = /status=(\d+)/i.exec(message);
  if (statusMatch) return Number.parseInt(statusMatch[1]!, 10);
  if (message.includes("AUTH_CREATE_MAX_ATTEMPTS")) return 429;
  const lower = message.toLowerCase();
  if (lower.includes("already been registered") || lower.includes("already registered")) {
    return 422;
  }
  if (lower.includes("invalid format") || lower.includes("unable to validate email")) return 422;
  if (lower.includes("500") || lower.includes("internal server")) return 500;
  if (isRateLimitError(message)) return 429;
  return null;
}

function failureCategory(message: string, status: number | null): string {
  if (status === 429) return "rate_limit";
  if (status === 422) return "validation";
  if (status === 500) return "server_5xx";
  if (status !== null && status >= 400) return `http_${status}`;
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("econnreset") || lower.includes("network")) {
    return "network";
  }
  return "other";
}

function logAndPersistAuthFailures(failed: ParallelAuthFailure[]): void {
  if (failed.length === 0) return;

  const statusDist = new Map<string, number>();
  const categoryDist = new Map<string, number>();
  const snippetSamples = new Map<string, string>();

  const persisted: PersistedAuthFailure[] = failed.map((f) => {
    const status = parseFailureStatus(f.message, f.status);
    const statusKey = status === null ? "unknown" : String(status);
    statusDist.set(statusKey, (statusDist.get(statusKey) ?? 0) + 1);

    const category = failureCategory(f.message, status);
    categoryDist.set(category, (categoryDist.get(category) ?? 0) + 1);

    const snippet = redactFailureMessage(f.message, 50);
    if (!snippetSamples.has(category)) {
      snippetSamples.set(category, snippet);
    }

    return {
      global_index: f.globalIndex,
      email_hash: hashId(f.email),
      status,
      message_snippet: snippet,
    };
  });

  const failuresPath = persistFailuresJsonl(persisted);

  logEvent(RUNNER, {
    action: "auth_failure_histogram",
    level: "error",
    count: failed.length,
    message: `rid=${getRid()} status_dist=${JSON.stringify(Object.fromEntries(statusDist))} category_dist=${JSON.stringify(Object.fromEntries(categoryDist))} samples=${JSON.stringify(Object.fromEntries(snippetSamples))}${failuresPath ? ` failures_file=${failuresPath.replace(/.*[\\/]logs[\\/]/, "logs/")}` : ""}`,
  });
}

async function createWithBackoff(
  env: SeedEnv,
  spec: ParallelAuthUserSpec,
  maxBackoffMs: number,
): Promise<
  | { readonly ok: true; result: ParallelAuthSuccess }
  | { readonly ok: false; failure: ParallelAuthFailure }
> {
  let attempt = 0;
  let backoffMs = 500;

  const maxAttempts = 12;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const started = Date.now();
    try {
      const created = await createAuthUser(
        env,
        {
          id: spec.id,
          email: spec.email,
          password: spec.password,
          role: spec.role,
          fullName: spec.fullName,
          phone: spec.phone,
          companyId: spec.companyId,
          locationId: spec.locationId,
        },
        { quiet: true },
      );
      return {
        ok: true as const,
        result: {
          globalIndex: spec.globalIndex,
          id: created.id,
          email: created.email,
          duration_ms: Date.now() - started,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isRateLimitError(message) && backoffMs <= maxBackoffMs) {
        const jitter = Math.floor(Math.random() * 200);
        await sleep(backoffMs + jitter);
        backoffMs = Math.min(maxBackoffMs, backoffMs * 2);
        continue;
      }
      const status = parseFailureStatus(message);
      return {
        ok: false as const,
        failure: {
          globalIndex: spec.globalIndex,
          email: spec.email,
          message,
          ...(status !== null ? { status } : {}),
        },
      };
    }
  }

  return {
    ok: false as const,
    failure: {
      globalIndex: spec.globalIndex,
      email: spec.email,
      message: "AUTH_CREATE_MAX_ATTEMPTS",
      status: 429,
    },
  };
}

async function runWorker(
  env: SeedEnv,
  queue: ParallelAuthUserSpec[],
  maxBackoffMs: number,
  onProgress: () => void,
): Promise<{ ok: ParallelAuthSuccess[]; failed: ParallelAuthFailure[]; rateLimited: number }> {
  const successes: ParallelAuthSuccess[] = [];
  const failed: ParallelAuthFailure[] = [];
  let rateLimited = 0;

  for (;;) {
    const next = queue.shift();
    if (!next) break;

    const result = await createWithBackoff(env, next, maxBackoffMs);
    if (result.ok === true) {
      successes.push(result.result);
    } else if (result.ok === false) {
      if (result.failure.status === 429) rateLimited += 1;
      failed.push(result.failure);
    }
    onProgress();
  }

  return { ok: successes, failed, rateLimited };
}

function workerCountFromEnv(fallback: number): number {
  const raw = (process.env.SEED_WORKERS ?? "").trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > 32) {
    throw new Error(`REFUSE_INVALID_SEED_WORKERS value=${raw}`);
  }
  return n;
}

export async function parallelCreateUsers(
  env: SeedEnv,
  specs: ParallelAuthUserSpec[],
  options?: ParallelAuthOptions,
): Promise<ParallelAuthResult> {
  const workers = options?.workers ?? workerCountFromEnv(10);
  const failureRateMax = options?.failureRateMax ?? 0.05;
  const maxBackoffMs = options?.maxBackoffMs ?? 30_000;

  const queue = [...specs];
  const started = Date.now();
  let processed = 0;

  const workerResults = await Promise.all(
    Array.from({ length: workers }, () =>
      runWorker(env, queue, maxBackoffMs, () => {
        processed += 1;
      }),
    ),
  );

  const ok = workerResults.flatMap((r) => r.ok);
  const failed = workerResults.flatMap((r) => r.failed);
  const rateLimited = workerResults.reduce((a, r) => a + r.rateLimited, 0);

  const durations = ok.map((r) => r.duration_ms);
  const perf = summarizePerf(durations);
  const durationMs = Date.now() - started;
  const total = specs.length;
  const failureRate = total > 0 ? failed.length / total : 0;

  const stats = {
    total,
    success: ok.length,
    failed: failed.length,
    rate_limited_429: rateLimited,
    duration_ms: durationMs,
    throughput_per_sec: durationMs > 0 ? (ok.length / durationMs) * 1000 : 0,
    p50_ms: perf.p50_ms,
    p95_ms: perf.p95_ms,
  };

  logEvent(RUNNER, {
    action: "auth_parallel_complete",
    count: ok.length,
    duration_ms: durationMs,
    message: `failed=${failed.length} rate_429=${rateLimited} throughput=${stats.throughput_per_sec.toFixed(2)}/s`,
  });

  if (failureRate > failureRateMax) {
    logAndPersistAuthFailures(failed);
    throw new Error(
      `AUTH_FAILURE_GATE failure_rate=${(failureRate * 100).toFixed(2)}% max=${(failureRateMax * 100).toFixed(0)}% failed=${failed.length} total=${total}`,
    );
  }

  return { ok, failed, stats };
}

export async function parallelDeleteAuthUsers(
  env: SeedEnv,
  userIds: string[],
  options?: { workers?: number; onProgress?: (done: number, total: number) => void },
): Promise<number> {
  const workers = options?.workers ?? workerCountFromEnv(10);
  const queue = [...userIds];
  const total = userIds.length;
  let deleted = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const id = queue.shift();
      if (!id) return;
      await deleteAuthUserById(env, id, { quiet: true });
      deleted += 1;
      options?.onProgress?.(deleted, total);
    }
  }

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return deleted;
}

/** Build specs with deterministic passwords from email. */
export function toParallelAuthSpecs(
  users: Array<{
    globalIndex: number;
    userId: string;
    email: string;
    role: "company_admin" | "employee";
    fullName: string;
    phone: string;
    companyId: string;
    locationId: string;
  }>,
): ParallelAuthUserSpec[] {
  return users.map((u) => ({
    globalIndex: u.globalIndex,
    id: u.userId,
    email: u.email,
    password: stagingPasswordForEmail(u.email),
    role: u.role,
    fullName: u.fullName,
    phone: u.phone,
    companyId: u.companyId,
    locationId: u.locationId,
  }));
}
