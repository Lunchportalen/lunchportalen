/**
 * Genererer utkast til sosialt innlegg fra produktdata — alltid manuell gjennomgang før publisering.
 */

import type { Industry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import { generatePost } from "@/lib/social/generatePost";
import { defaultSocialLocation, type Location } from "@/lib/social/location";

export type GeneratedSocialPost = {
  text: string;
  hashtags: string[];
  platforms: ("instagram" | "facebook")[];
  /** Attributjon mot kalender/CRM (lenken har ?src=) */
  leadSourceId?: string;
  industry?: Industry;
  targetRole?: Role;
};

export function generatePostFromStrategy(
  product: SocialProductRef,
  location: Location = defaultSocialLocation,
  industry?: Industry,
  targetRole?: Role,
): GeneratedSocialPost {
  const body = generatePost(product, location, product.id, industry, targetRole);
  return {
    text: body.text,
    hashtags: body.hashtags,
    platforms: ["instagram", "facebook"],
    leadSourceId: body.leadSourceId,
    industry: body.industry,
    targetRole: body.targetRole,
  };
}
