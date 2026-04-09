/**
 * AI Social Engine — innholdsutkast (B2B kalender-motor + CMS media + deterministisk «intelligens»).
 */

import "server-only";

import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import type { GeneratedSocialPostPayload, LearningEngagementTier, SocialGenerateContext } from "@/lib/social/enginePayload";
export type { GeneratedSocialPostPayload, LearningEngagementTier, SocialGenerateContext } from "@/lib/social/enginePayload";

import { attachAttributionToLink } from "@/lib/revenue/attribution";
import { pickB2bCta } from "@/lib/social/b2bLeadMessaging";
import { generateCalendarSlotContent } from "@/lib/social/calendarContent";
import { getMediaForProduct } from "@/lib/social/mediaAdapter";

function applyTierToCopy(
  product: SocialProductRef,
  base: { hook: string; caption: string; hashtags: string[] },
  tier: LearningEngagementTier | undefined,
): { hook: string; caption: string } {
  const t = tier ?? "mid";
  let hook = base.hook;
  let caption = base.caption;

  if (t === "high") {
    hook = `Når hverdagen krever kontroll: ${base.hook}`;
    caption = `${caption}\n\nHistorien: ${product.name} støtter team som vil spise bedre sammen — med mindre administrasjon og mer forutsigbarhet.`;
  } else if (t === "low") {
    const firstBlock = caption.split(/\n\n+/)[0] ?? caption;
    caption = firstBlock.length > 280 ? `${firstBlock.slice(0, 277)}…` : firstBlock;
  }

  return { hook, caption };
}

/**
 * Async: henter CMS-media; innhold ellers deterministisk (samme motor som kalender, ingen ekstern LLM).
 */
export async function generatePost(
  product: SocialProductRef,
  context: SocialGenerateContext,
): Promise<GeneratedSocialPostPayload> {
  const pid = String(product.id ?? "").trim();
  if (!pid) {
    return {
      text: "",
      hook: "",
      cta: "",
      hashtags: [],
      media: { imageUrl: null, mediaItemId: null },
      revenueTrackingPath: null,
      link: null,
    };
  }

  const media = await getMediaForProduct(pid);

  const c = generateCalendarSlotContent(product, context.slotDay, context.location, context.calendarPostId);
  const { hook, caption } = applyTierToCopy(product, c, context.learningEngagementTier);

  const cta = pickB2bCta(`${context.slotDay}|${pid}|${context.learningEngagementTier ?? "mid"}|${media.mediaItemId ?? "none"}`);
  const text = `${caption}\n\n${cta}\n\n${c.hashtags.join(" ")}`.trim();
  const postIdForTracking = String(context.calendarPostId ?? "").trim();
  const revenueTrackingPath = attachAttributionToLink(postIdForTracking, pid);
  const link =
    postIdForTracking.length > 0
      ? `/api/social/redirect?postId=${encodeURIComponent(postIdForTracking)}`
      : null;

  return {
    text,
    hook,
    cta,
    hashtags: c.hashtags,
    media,
    revenueTrackingPath,
    link,
  };
}
