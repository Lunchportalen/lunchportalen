/**
 * Deterministic URL helpers for AI Social → landing → order attribution.
 * Does not invent clicks or revenue; only builds/merges query params.
 */

import { AI_SOCIAL_ATTRIBUTION_SOURCE } from "@/lib/revenue/types";

const POST_ID_RE = /^[a-zA-Z0-9_.:-]{1,128}$/;
const PRODUCT_PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function safePostId(postId: string): string | null {
  const s = String(postId ?? "").trim();
  return POST_ID_RE.test(s) ? s : null;
}

function safeProductSegment(productId: string): string {
  const s = String(productId ?? "").trim();
  if (PRODUCT_PATH_SEGMENT_RE.test(s)) return s;
  const alnum = s.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
  return alnum.length > 0 ? alnum : "unknown";
}

/**
 * Canonical internal path for shared links (adds query params only).
 */
export function attachAttributionToLink(postId: string, productId: string): string {
  const pid = safePostId(postId);
  const seg = safeProductSegment(productId);
  if (!pid) {
    return `/product/${seg}`;
  }
  const q = new URLSearchParams();
  q.set("src", AI_SOCIAL_ATTRIBUTION_SOURCE);
  q.set("postId", pid);
  return `/product/${seg}?${q.toString()}`;
}

/**
 * Add postId to an absolute URL without removing existing params (preserves ?src= lead IDs).
 */
export function appendRevenuePostIdToAbsoluteUrl(rawUrl: string, postId: string): string {
  const u = String(rawUrl ?? "").trim();
  if (!u || u === "#") return u;
  if (!/^https?:\/\//i.test(u)) return u;
  const pid = safePostId(postId);
  if (!pid) return u;
  try {
    const parsed = new URL(u);
    if (!parsed.searchParams.has("postId")) {
      parsed.searchParams.set("postId", pid);
    }
    return parsed.toString();
  } catch {
    return u;
  }
}

export function isValidAiSocialLanding(src: string | null | undefined, postId: string | null | undefined): boolean {
  return (
    String(src ?? "").trim() === AI_SOCIAL_ATTRIBUTION_SOURCE && safePostId(String(postId ?? "").trim()) !== null
  );
}

/** Server-only omsetningskobling per SoMe-post: {@link getRevenueByPost} i `./getRevenueByPost`. */
