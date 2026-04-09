import "server-only";

import { randomUUID } from "crypto";

import { generateConversionPost } from "@/lib/ai/conversionGenerator";
import { optimizeCTA } from "@/lib/ai/ctaOptimizer";
import { attachAttributionToLink } from "@/lib/revenue/attribution";
import { generatePost } from "@/lib/social/generator";
import { getMediaForProduct } from "@/lib/social/mediaAdapter";
import { socialConfig } from "@/lib/social/location";
import { SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS } from "@/lib/social/superadminEngineSeed";
import type { SocialPlatform } from "@/lib/social/socialPostContent";
import { normalizePlatform } from "@/lib/social/socialPostContent";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { UnifiedSocialInput, UnifiedSocialResult } from "@/lib/social/unifiedSocialTypes";

export type { UnifiedSocialInput, UnifiedSocialResult } from "@/lib/social/unifiedSocialTypes";

function extractHashtags(text: string): string[] {
  const m = text.match(/#[\p{L}\d_]+/gu);
  return m ?? [];
}

function pickProduct(input: UnifiedSocialInput): SocialProductRef {
  const id = typeof input.productId === "string" ? input.productId.trim() : "";
  if (id) {
    const found = SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS.find((p) => p.id === id);
    if (found) return found;
  }
  return SUPERADMIN_SOCIAL_ENGINE_DEMO_PRODUCTS[0]!;
}

async function runDeterministicCore(input: UnifiedSocialInput, calendarPostId: string, platform: SocialPlatform): Promise<UnifiedSocialResult> {
  const product = pickProduct(input);
  const slotDay = typeof input.slotDay === "string" && input.slotDay.trim() ? input.slotDay.trim() : "monday";
  const r = await generatePost(product, {
    slotDay,
    location: socialConfig.location,
    calendarPostId,
    learningEngagementTier: "mid",
  });
  const images = r.media?.imageUrl ? [String(r.media.imageUrl)] : [];
  return {
    text: r.text,
    hashtags: Array.isArray(r.hashtags) ? r.hashtags : [],
    images,
    source: "deterministic",
    platform,
    calendarPostId,
    revenueTrackingPath: r.revenueTrackingPath ?? null,
    link: r.link ?? null,
  };
}

/**
 * Én inngang for SoMe-utkast: deterministisk motor eller AI (med fail-closed fallback til deterministisk).
 */
export async function runUnifiedSocialGeneration(opts: {
  mode: "deterministic" | "ai";
  input: UnifiedSocialInput;
}): Promise<UnifiedSocialResult> {
  const platform = normalizePlatform(opts.input.platform);
  const calendarPostId =
    typeof opts.input.calendarPostId === "string" && opts.input.calendarPostId.trim()
      ? opts.input.calendarPostId.trim()
      : `draft_${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  if (opts.mode === "deterministic") {
    return runDeterministicCore(opts.input, calendarPostId, platform);
  }

  const product = pickProduct(opts.input);
  const productName = typeof opts.input.product === "string" && opts.input.product.trim() ? opts.input.product.trim() : product.name;
  const audience =
    typeof opts.input.audience === "string" && opts.input.audience.trim()
      ? opts.input.audience.trim()
      : "bedrifter med 20+ ansatte";
  const goal = typeof opts.input.goal === "string" && opts.input.goal.trim() ? opts.input.goal.trim() : "book møte";

  try {
    const { getGrowthHintsForPrompt } = await import("@/lib/growth/getGrowthHintsForPrompt");
    const { getRevenueHooksForPrompt } = await import("@/lib/revenue/revenueLearning");
    const growthHints = await getGrowthHintsForPrompt();
    const revenueHints = await getRevenueHooksForPrompt();
    const ai = await generateConversionPost({
      product: productName,
      audience,
      goal,
      ...(growthHints ? { growthHints } : {}),
      ...(revenueHints ? { revenueHints } : {}),
    });
    const text = optimizeCTA(ai.text);
    const hashtags = extractHashtags(text);
    const revenueTrackingPath = attachAttributionToLink(calendarPostId, product.id);
    const link = `/api/social/redirect?postId=${encodeURIComponent(calendarPostId)}`;

    if (!ai.ok) {
      const fb = await runDeterministicCore(opts.input, calendarPostId, platform);
      return { ...fb, source: "fallback", aiOk: false };
    }

    const media = await getMediaForProduct(product.id);
    const images = media?.imageUrl ? [String(media.imageUrl)] : [];

    return {
      text,
      hashtags,
      images,
      source: "ai",
      platform,
      aiOk: true,
      calendarPostId,
      revenueTrackingPath,
      link,
    };
  } catch {
    const fb = await runDeterministicCore(opts.input, calendarPostId, platform);
    return { ...fb, source: "fallback", aiOk: false };
  }
}
