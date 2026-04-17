import React from "react";
import { RichTextCanvasBlock } from "@/components/blocks/RichTextCanvasBlock";
import { Section } from "@/components/ui/Section";
import type { MergedDesign, ParsedDesignSettings } from "@/lib/cms/design/designContract";
import {
  cardSurfaceClassString,
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
  resolvedCardForBlockType,
} from "@/lib/cms/design/designContract";

export type MarketingTextBlockVisualEdit = {
  onPatch: (patch: Record<string, unknown>) => void;
};

export type MarketingTextBlockProps = {
  merged: MergedDesign;
  designSettings: ParsedDesignSettings | null;
  heading: string;
  body: string;
  motion?: boolean;
  visualCanvasEdit?: MarketingTextBlockVisualEdit | null;
};

/**
 * Locked rich text section (`richText`): card surface, max-width body, optional canvas edit.
 */
export function MarketingTextBlock({
  merged,
  designSettings,
  heading,
  body,
  motion = true,
  visualCanvasEdit,
}: MarketingTextBlockProps) {
  const ds = designSettings;
  return (
    <Section
      sectionClassName={marketingSectionClassString(merged, { motion })}
      containerClassName={marketingContainerClassString(merged)}
    >
      <div className={cardSurfaceClassString(resolvedCardForBlockType("richText", merged.card, ds))}>
        {visualCanvasEdit ?
          <RichTextCanvasBlock
            headingClass={mergedHeadingClassString(merged, "h2")}
            bodyClass={mergedBodyClassString(merged)}
            heading={heading}
            body={body}
            onPatch={visualCanvasEdit.onPatch}
          />
        : <>
            {heading ?
              <h2 className={mergedHeadingClassString(merged, "h2")}>{heading}</h2>
            : null}
            {body ? <div className={mergedBodyClassString(merged)}>{body}</div> : null}
          </>
        }
      </div>
    </Section>
  );
}
