/**
 * Bounded async helpers — timeouts and limited retries (no infinite loops).
 */

export class AsyncTimeoutError extends Error {
  override readonly name = "AsyncTimeoutError";

  constructor(
    readonly ms: number,
    readonly label?: string,
  ) {
    super(label ? `Timeout after ${ms}ms (${label})` : `Timeout after ${ms}ms`);
  }
}

/**
 * Rejects if `promise` does not settle within `ms`.
 */
export async function withTimeout<T>(promise: Promise<T> | PromiseLike<T>, ms: number, label?: string): Promise<T> {
  const settled = Promise.resolve(promise);
  if (!Number.isFinite(ms) || ms <= 0) {
    return settled;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      settled,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new AsyncTimeoutError(ms, label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export type RetryOpts = {
  maxAttempts: number;
  /** Base delay ms (linear backoff: attempt * baseDelayMs). */
  baseDelayMs?: number;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Retries only when `shouldRetry(err)` returns true. Max attempts inclusive of first try.
 * Default maxAttempts = 3 → up to 2 retries after failure.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOpts,
  shouldRetry: (err: unknown) => boolean,
): Promise<T> {
  const max = Math.min(10, Math.max(1, Math.floor(opts.maxAttempts)));
  const base = Math.max(0, opts.baseDelayMs ?? 50);
  let lastErr: unknown;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      return await fn(attempt);
    } catch (e) {
      lastErr = e;
      if (attempt >= max || !shouldRetry(e)) throw e;
      await sleep(base * attempt);
    }
  }
  throw lastErr;
}
