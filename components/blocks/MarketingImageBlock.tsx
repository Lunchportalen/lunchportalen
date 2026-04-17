import React from "react";
import MediaFrame from "@/components/ui/MediaFrame";
import { Section } from "@/components/ui/Section";
import type { MergedDesign, ParsedDesignSettings } from "@/lib/cms/design/designContract";
import {
  cardSurfaceClassString,
  marketingContainerClassString,
  marketingSectionClassString,
  resolvedCardForBlockType,
} from "@/lib/cms/design/designContract";

export type MarketingImageBlockProps = {
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  src: string | null;
  alt: string;
  caption: string;
};

/**
 * Locked figure block (`image`): MediaFrame + optional caption.
 */
export function MarketingImageBlock({ merged, designSettings, src, alt, caption }: MarketingImageBlockProps) {
  const ds = designSettings;
  return (
    <Section
      sectionClassName={marketingSectionClassString(merged, { motion: true })}
      containerClassName={marketingContainerClassString(merged)}
    >
      <figure
        className={`${cardSurfaceClassString(resolvedCardForBlockType("image", merged.card, ds))} flex flex-col gap-3`}
      >
        <MediaFrame src={src} alt={alt} />
        {caption ?
          <figcaption
            className={
              merged.typography.body === "compact"
                ? "font-body lp-p-sm whitespace-pre-line text-xs"
                : "font-body lp-muted whitespace-pre-line text-xs"
            }
          >
            {caption}
          </figcaption>
        : null}
      </figure>
    </Section>
  );
}
