/**
 * Safe metadata for public/preview rendering.
 * Single place for alt/caption fallbacks and length bounds so invalid or
 * oversized metadata never corrupts img/figcaption output.
 */

import { MEDIA_ALT_MAX, MEDIA_CAPTION_MAX } from "./validation";

function toStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  return String(v).trim();
}

/**
 * Returns a safe string for img alt attribute. Uses alt first, then caption fallback.
 * Bounded to MEDIA_ALT_MAX. Never returns non-string or unbounded content.
 */
export function safeAltForImg(alt: unknown, captionFallback?: unknown): string {
  const s = toStr(alt) || toStr(captionFallback);
  return s.slice(0, MEDIA_ALT_MAX);
}

/**
 * Returns a safe string for figcaption. Bounded to MEDIA_CAPTION_MAX.
 */
export function safeCaptionForFigcaption(caption: unknown, altFallback?: unknown): string {
  const s = toStr(caption) || toStr(altFallback);
  return s.slice(0, MEDIA_CAPTION_MAX);
}
