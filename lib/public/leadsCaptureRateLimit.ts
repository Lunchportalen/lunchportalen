import "server-only";

import { getRedis } from "@/lib/infra/redis";
import { anonRateLimitOk, clientIpFromAnonRequest } from "@/lib/public/anonRouteGuard";

const PREFIX = "leads-capture";
const MAX_PER_MINUTE = 5;

function minuteBucket(): number {
  return Math.floor(Date.now() / 60_000);
}

/**
 * Rate limit for POST /api/public/leads/capture — 5 requests/min per IP (F1/F2).
 *
 * When REDIS_URL is set, uses Redis INCR with 60s TTL (shared across serverless instances).
 * Otherwise falls back to in-memory Map (best-effort per instance only — not global).
 */
export async function leadsCaptureRateLimitOk(req: Request): Promise<boolean> {
  const ip = clientIpFromAnonRequest(req);
  const redis = await getRedis();

  if (redis) {
    try {
      const key = `lp:${PREFIX}:${ip}:${minuteBucket()}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.expire(key, 60);
      }
      return count <= MAX_PER_MINUTE;
    } catch {
      /* fall through to in-memory */
    }
  }

  return anonRateLimitOk(PREFIX, ip, MAX_PER_MINUTE);
}
