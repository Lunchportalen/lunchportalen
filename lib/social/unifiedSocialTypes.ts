import type { SocialPlatform } from "@/lib/social/socialPostContent";

/** Inndata til én samlet SoMe-generering (AI med deterministisk fallback). */
export type UnifiedSocialInput = {
  product?: string;
  audience?: string;
  goal?: string;
  productId?: string;
  slotDay?: string;
  platform?: SocialPlatform | string;
  calendarPostId?: string;
};

export type UnifiedSocialResult = {
  text: string;
  hashtags: string[];
  images: string[];
  source: "ai" | "deterministic" | "fallback";
  platform: SocialPlatform;
  aiOk?: boolean;
  calendarPostId: string;
  revenueTrackingPath?: string | null;
  link?: string | null;
};
