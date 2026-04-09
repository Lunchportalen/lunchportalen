/**
 * Standardisert `social_posts.content` (jsonb) — v1 kontrakt for AI + deterministisk motor.
 * Bakoverkompatibel: eldre felt (hook, caption) kan fortsatt finnes i rå jsonb.
 */

export type SocialPlatform = "linkedin" | "facebook" | "instagram";

export type SocialContentSource = "ai" | "deterministic" | "fallback";

export type StandardSocialContentV1 = {
  v: 1;
  text: string;
  hashtags: string[];
  images: string[];
  source: SocialContentSource;
  platform: SocialPlatform;
  metrics: {
    views: number;
    clicks: number;
    conversions: number;
  };
  data: {
    calendarPostId?: string;
    revenueTrackingPath?: string | null;
    link?: string | null;
    productId?: string;
  };
};

export function normalizePlatform(raw: unknown): SocialPlatform {
  const s = String(raw ?? "").toLowerCase();
  if (s === "linkedin" || s === "facebook" || s === "instagram") return s;
  return "linkedin";
}

export function buildStandardSocialContentV1(input: {
  text: string;
  hashtags: string[];
  images: string[];
  source: SocialContentSource;
  platform: SocialPlatform;
  data?: StandardSocialContentV1["data"];
}): StandardSocialContentV1 {
  return {
    v: 1,
    text: input.text,
    hashtags: Array.isArray(input.hashtags) ? input.hashtags : [],
    images: Array.isArray(input.images) ? input.images : [],
    source: input.source,
    platform: input.platform,
    metrics: { views: 0, clicks: 0, conversions: 0 },
    data: input.data ?? {},
  };
}
