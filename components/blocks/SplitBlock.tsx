import React from "react";
import MediaFrame from "@/components/ui/MediaFrame";
import { Section } from "@/components/ui/Section";
import { TextBlock } from "@/components/ui/TextBlock";
import type { MergedDesign, ParsedDesignSettings } from "@/lib/cms/design/designContract";
import {
  cardSurfaceClassString,
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
  resolvedCardForBlockType,
} from "@/lib/cms/design/designContract";

export type SplitBlockVariant = "left" | "right";

export type SplitBlockProps = {
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  title: string;
  body: string;
  imageSrc: string | null;
  imageAlt: string;
  /** Image column on the left (default) or right. */
  variant: SplitBlockVariant;
};

/**
 * Locked split story layout (image + copy). For future CMS types / AI-only mappings.
 */
export function SplitBlock({
  merged,
  designSettings,
  title,
  body,
  imageSrc,
  imageAlt,
  variant,
}: SplitBlockProps) {
  const ds = designSettings;
  const imageFirst = variant !== "right";
  const media = (
    <div className="min-w-0">
      <MediaFrame src={imageSrc} alt={imageAlt} className="rounded-2xl" />
    </div>
  );
  const copy = (
    <div className="flex min-w-0 flex-col justify-center gap-3">
      {title ?
        <h2 className={mergedHeadingClassString(merged, "h2")}>{title}</h2>
      : null}
      {body ? <TextBlock className={mergedBodyClassString(merged, { measure: true })}>{body}</TextBlock> : null}
    </div>
  );

  return (
    <Section sectionClassName={marketingSectionClassString(merged, { motion: true })} containerClassName={marketingContainerClassString(merged)}>
      <div
        className={`${cardSurfaceClassString(resolvedCardForBlockType("richText", merged.card, ds))} grid gap-8 p-6 md:grid-cols-2 md:items-center md:gap-10 md:p-10`}
      >
        {imageFirst ?
          <>
            {media}
            {copy}
          </>
        : <>
            {copy}
            {media}
          </>
        }
      </div>
    </Section>
  );
}
