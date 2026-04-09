/**
 * Deterministic fixes before applying AI-generated or skeleton pages.
 */

import { newBlockId } from "@/lib/cms/model/blockId";
import type { CmsSerializedBlock } from "./normalizeCmsBlocks";
import { ensureTrailingCta } from "./normalizeCmsBlocks";

const MAX_BLOCKS = 20;

function heroToRichText(h: Extract<CmsSerializedBlock, { type: "hero" }>): Extract<CmsSerializedBlock, { type: "richText" }> {
  const body = [h.subtitle, h.ctaLabel ? `${h.ctaLabel}: ${h.ctaHref ?? "#"}` : ""].filter(Boolean).join("\n\n");
  return {
    id: newBlockId(),
    type: "richText",
    heading: h.title,
    body: body || "Innhold fra ekstra toppseksjon.",
  };
}

/**
 * - Max 20 blocks
 * - Single hero (extra heroes → richText)
 * - At least one CTA (ensureTrailingCta)
 */
export function applyAiPageGuardrails(blocks: CmsSerializedBlock[]): CmsSerializedBlock[] {
  let out = blocks.slice(0, MAX_BLOCKS);
  let seenHero = false;
  const next: CmsSerializedBlock[] = [];

  for (const b of out) {
    if (b.type === "hero") {
      if (!seenHero) {
        seenHero = true;
        next.push(b);
      } else {
        next.push(heroToRichText(b));
      }
      continue;
    }
    next.push(b);
  }

  out = ensureTrailingCta(next);
  return out.slice(0, MAX_BLOCKS);
}
