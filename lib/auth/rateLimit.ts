// lib/auth/rateLimit.ts
import "server-only";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function nowMs() {
  return Date.now();
}

function getClientKey(ip: string, ua: string) {
  const u = (ua || "").slice(0, 80);
  return `${ip}|${u}`;
}

export function readClientIp(headers: Headers): string {
  // conservative (fail-closed)
  const xf = headers.get("x-forwarded-for") || "";
  const first = xf.split(",")[0]?.trim();
  return first || headers.get("x-real-ip") || "0.0.0.0";
}

export function rateLimitOrThrow(opts: {
  key: string; // endpoint key e.g. "post-login"
  ip: string;
  ua: string;
  limit: number;
  windowMs: number;
}) {
  const k = `${opts.key}:${getClientKey(opts.ip, opts.ua)}`;
  const t = nowMs();

  const b = buckets.get(k);
  if (!b || b.resetAt <= t) {
    buckets.set(k, { count: 1, resetAt: t + opts.windowMs });
    return { ok: true, remaining: opts.limit - 1, resetAt: t + opts.windowMs };
  }

  b.count += 1;

  if (b.count > opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((b.resetAt - t) / 1000));
    return { ok: false, remaining: 0, resetAt: b.resetAt, retryAfterSec };
  }

  buckets.set(k, b);
  return { ok: true, remaining: Math.max(0, opts.limit - b.count), resetAt: b.resetAt };
}
