/**
 * Canonical variant URL selection for media_items (metadata.variants).
 * No separate asset table — variants live in metadata JSONB.
 */

import type { MediaItemMetadata } from "./types";
import { validateMediaUrl } from "./validation";

/** Max keys per variants map (defensive). */
export const MEDIA_VARIANTS_MAX_KEYS = 16;

/**
 * Optional map of variant key → absolute https URL (e.g. w640, w960, og).
 * Invalid URLs are omitted at write time (API) or ignored at read time.
 */
export function normalizeVariantsMap(raw: unknown): Record<string, string> | undefined {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(o)) {
    if (count >= MEDIA_VARIANTS_MAX_KEYS) break;
    const key = String(k).trim();
    if (!key || key.length > 32) continue;
    if (typeof v !== "string") continue;
    const u = v.trim();
    const check = validateMediaUrl(u);
    if (check.ok) {
      out[key] = u;
      count += 1;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/**
 * Pick display URL: variant key if present and valid, else primary `url`.
 */
export function pickResolvedUrlFromMetadata(
  primaryUrl: string,
  metadata: MediaItemMetadata | undefined,
  variantKey?: string | null
): string {
  const u = typeof primaryUrl === "string" ? primaryUrl.trim() : "";
  if (!u) return "";
  const key = typeof variantKey === "string" ? variantKey.trim() : "";
  if (!key) return u;
  const raw = metadata?.variants;
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return u;
  const map = raw as Record<string, unknown>;
  const candidate = map[key];
  if (typeof candidate !== "string" || !candidate.trim()) return u;
  const check = validateMediaUrl(candidate.trim());
  return check.ok ? candidate.trim() : u;
}
