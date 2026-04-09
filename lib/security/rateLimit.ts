/**
 * Sentrale rate-limit-konstanter (IP/identitet håndheves i hver rute).
 * Bruk sammen med `checkAiRateLimit` eller egne vinduer.
 *
 * **Sliding overload bucket** (`rateLimit` / `rateLimitOverload`): per-prosess, O(1),
 * cap på antall nøkler (`SLIDING_MAX_KEYS`) for å beskytte minne. Erstatter ikke edge/WAF.
 *
 * **Ruter (referanse):** `POST /api/contact` (identity IP + `checkAiRateLimit` + overload),
 * `GET /api/social/ai`, `POST /api/autonomy/run` — samme mønster.
 */
import { AI_RATE_LIMIT_SCOPE, checkAiRateLimit, type AiRateLimitConfig } from "@/lib/ai/rateLimit";

export { AI_RATE_LIMIT_SCOPE, checkAiRateLimit };

/** Offentlig kontakt — streng (misbruk). */
export const CONTACT_FORM_RL: AiRateLimitConfig = { windowSeconds: 60, max: 5 };

/** SoMe AI-pakke (superadmin). */
export const SOCIAL_AI_RL: AiRateLimitConfig = { windowSeconds: 60, max: 20 };

/** Autonomi-kjøring (superadmin, tung). */
export const AUTONOMY_RUN_RL: AiRateLimitConfig = { windowSeconds: 60, max: 20 };

/** Salgsutsendelse — allerede begrenset i rute; referanse for dokumentasjon. */
export const SALES_SEND_RL: AiRateLimitConfig = { windowSeconds: 3600, max: 30 };

type SlidingEntry = { count: number; ts: number };

const slidingBucket = new Map<string, SlidingEntry>();
/** Memory bound for horizontal replicas (each instance has its own map). */
export const SLIDING_MAX_KEYS = 20_000;

/**
 * Sliding 60s window (additive overload protection). Not a substitute for edge/WAF rate limits.
 */
export function rateLimit(key: string, limit = 20): boolean {
  const now = Date.now();
  if (slidingBucket.size > SLIDING_MAX_KEYS) {
    slidingBucket.clear();
  }
  let entry = slidingBucket.get(key);
  if (!entry) {
    entry = { count: 0, ts: now };
  }
  if (now - entry.ts > 60_000) {
    entry.count = 0;
    entry.ts = now;
  }
  entry.count++;
  slidingBucket.set(key, entry);
  return entry.count <= limit;
}

/** Load shedding: stricter cap (e.g. per-IP). */
export function rateLimitOverload(key: string, limit = 50): boolean {
  return rateLimit(`overload:${key}`, limit);
}
