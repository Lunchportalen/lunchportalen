/**
 * B2B lead-generator — beslutningstakere, 20–200 ansatte, demo/tilbud/løsning.
 */

import type { Industry } from "@/lib/ai/industry";
import { detectIndustry } from "@/lib/ai/industry";
import type { Role } from "@/lib/ai/role";
import type { SocialProductRef } from "@/lib/ai/socialStrategy";
import { buildB2bLeadPostCopy } from "@/lib/social/b2bLeadMessaging";
import { generateLunchHashtags } from "@/lib/social/hashtags";
import { leadSourceIdFromProductId } from "@/lib/social/leadSource";
import type { Location } from "@/lib/social/location";

export type GeneratedPostBody = {
  text: string;
  hashtags: string[];
  /** Sporings-ID (også i lenke som ?src=) */
  leadSourceId: string;
  industry: Industry;
  targetRole: Role;
};

export function generatePost(
  product: SocialProductRef,
  location: Location,
  rotationSeed?: string,
  industry?: Industry,
  targetRole?: Role,
): GeneratedPostBody {
  const seed = rotationSeed ?? String(product.id ?? "") + String(product.name ?? "");
  const ls = leadSourceIdFromProductId(String(product.id ?? "unknown"));
  const ind = industry ?? detectIndustry(`${product.name} ${product.url}`);
  const copy = buildB2bLeadPostCopy(product, location, seed, ls, ind, targetRole);
  const hashtags = generateLunchHashtags({ location, rotationSeed: seed });

  const text = `${copy.text}

${hashtags.join(" ")}`;

  return { text, hashtags, leadSourceId: ls, industry: copy.industry, targetRole: copy.targetRole };
}
