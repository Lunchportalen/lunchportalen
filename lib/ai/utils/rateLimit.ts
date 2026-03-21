/**
 * AI rate limiting: prevent AI abuse.
 * In-memory, per-identity and per-scope (e.g. tool or route). Prunes old buckets to bound memory.
 * Use after auth: identity should be userId or email; do not key by untrusted input alone.
 */

export type AiRateLimitConfig = {
  /** Time window in seconds (e.g. 3600 = 1 hour). */
  windowSeconds: number;
  /** Max requests per identity per scope within the window. */
  max: number;
};

export type AiRateLimitResult = {
  /** Whether the request is allowed. */
  allowed: boolean;
  /** Remaining requests in current window (0 when not allowed). */
  remaining: number;
  /** Suggested Retry-After in seconds when not allowed. */
  retryAfterSeconds?: number;
};

const store = new Map<string, { count: number; windowStartMs: number }>();

const PRUNE_AFTER_WINDOWS = 2;

/**
 * Prunes entries older than (current window - PRUNE_AFTER_WINDOWS) to avoid unbounded growth.
 */
function prune(scope: string, windowMs: number, currentBucketStart: number): void {
  const cutoff = currentBucketStart - PRUNE_AFTER_WINDOWS * windowMs;
  for (const [key, entry] of store) {
    if (key.startsWith(scope + ":") && entry.windowStartMs < cutoff) {
      store.delete(key);
    }
  }
}

/**
 * Checks and consumes one request from the rate limit for the given identity and scope.
 * Call once per request; if allowed, the counter is incremented.
 *
 * @param identity - Stable identifier (e.g. user id or email from auth). Do not use untrusted input alone.
 * @param scope - Scope of the limit (e.g. "ai:suggest", "ai:block-builder", "ai:seo-intelligence").
 * @param config - windowSeconds and max per window.
 * @returns allowed, remaining, and optional retryAfterSeconds (when not allowed).
 */
export function checkAiRateLimit(
  identity: string,
  scope: string,
  config: AiRateLimitConfig
): AiRateLimitResult {
  const { windowSeconds, max } = config;
  if (max <= 0) {
    return { allowed: true, remaining: 0 };
  }

  const windowMs = windowSeconds * 1000;
  const now = Date.now();
  const windowStartMs = Math.floor(now / windowMs) * windowMs;
  const key = `${scope}:${identity}:${windowStartMs}`;

  prune(scope, windowMs, windowStartMs);

  const entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, windowStartMs });
    return {
      allowed: true,
      remaining: max - 1,
    };
  }

  if (entry.count >= max) {
    const retryAfterSeconds = Math.ceil((windowStartMs + windowMs - now) / 1000);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, retryAfterSeconds),
    };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: max - entry.count,
  };
}

/** Default rate limit for editor AI routes (e.g. block-builder, page-builder): 60/hour per user. */
export const DEFAULT_AI_EDITOR_RATE_LIMIT: AiRateLimitConfig = {
  windowSeconds: 3600,
  max: 60,
};

/** Default rate limit for apply/log routes: 120/hour to avoid log abuse. */
export const DEFAULT_AI_APPLY_RATE_LIMIT: AiRateLimitConfig = {
  windowSeconds: 3600,
  max: 120,
};

/** Scope prefix for all AI rate limits. */
export const AI_RATE_LIMIT_SCOPE = "ai";
