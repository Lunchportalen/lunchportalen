/**
 * Kalender-slots — samme B2B lead-motor som generatePost.
 */

import type { Industry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import { buildB2bLeadPostCopy, type B2bArchetype, type B2bCtaLine, type B2bValuePillar } from "@/lib/social/b2bLeadMessaging";
import { generateLunchHashtags } from "@/lib/social/hashtags";
import { leadSourceIdFromPostId } from "@/lib/social/leadSource";
import type { Location } from "@/lib/social/location";

export type CalendarPostContent = {
  hook: string;
  caption: string;
  hashtags: string[];
  archetype: B2bArchetype;
  valuePillar: B2bValuePillar;
  cta: B2bCtaLine;
  industry: Industry;
  targetRole: Role;
  /** Kompakt tekst for publisering / hash for duplikatsjekk */
  fullText: string;
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

export function contentHashForCalendar(content: CalendarPostContent): string {
  return String(hashString(content.fullText.trim().toLowerCase()));
}

/**
 * @param calendarPostId — når satt, får CTA-lenken ?src=post_<id> (hash uten sporingsparam).
 */
export function generateCalendarSlotContent(
  product: SocialProductRef,
  slotDay: string,
  location: Location,
  calendarPostId?: string,
): CalendarPostContent {
  const seed = `${slotDay}|${product.id}`;
  const ls = calendarPostId ? leadSourceIdFromPostId(calendarPostId) : undefined;
  const copy = buildB2bLeadPostCopy(product, location, seed, ls, undefined, undefined, calendarPostId);
  const hashtags = generateLunchHashtags({ location, rotationSeed: seed });
  const canonicalUrl = String(product.url ?? "").trim() || "#";
  const fullText = `${slotDay}|${location}|${copy.industry}|${copy.targetRole}|${copy.archetype}|${copy.valuePillar}|${copy.hook}|${canonicalUrl}|${hashtags.join(",")}`;
  return {
    hook: copy.hook,
    caption: copy.caption,
    hashtags,
    archetype: copy.archetype,
    valuePillar: copy.valuePillar,
    cta: copy.cta,
    industry: copy.industry,
    targetRole: copy.targetRole,
    fullText,
  };
}
