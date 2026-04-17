import React from "react";
import { Section } from "@/components/ui/Section";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergedBodyClassString,
  mergedHeadingClassString,
} from "@/lib/cms/design/designContract";
import { normalizeDisplayText } from "@/lib/public/blocks/renderBlock";
import { safeAltForImg } from "@/lib/media/renderSafe";

export type MarketingZigzagStep = {
  step: string;
  title: string;
  text: string;
  imageSrc: string | null;
  kicker?: string;
};

export type MarketingZigzagBlockProps = {
  merged: MergedDesign;
  sectionTitle: string;
  sectionIntro?: string;
  steps: MarketingZigzagStep[];
};

/**
 * Locked zigzag / process layout (`zigzag`).
 */
export function MarketingZigzagBlock({ merged, sectionTitle, sectionIntro, steps }: MarketingZigzagBlockProps) {
  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      <div className="lp-section-head">
        <h2 className={mergedHeadingClassString(merged, "h2")}>{sectionTitle}</h2>
        {sectionIntro ?
          <p className={`${mergedBodyClassString(merged, { measure: true })} mt-2`}>{sectionIntro}</p>
        : null}
      </div>

      <div className="lp-zig">
        {steps.map((step, i) => (
          <div key={i} className={`lp-zig-row ${i % 2 ? "is-reverse" : ""}`}>
            <div className="lp-zig-text">
              <div className="lp-zig-step">
                <span className="lp-neon-ring">{step.step}</span>
                <div>
                  {step.kicker ?
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[rgb(var(--lp-muted))]">
                      {step.kicker}
                    </p>
                  : null}
                  <h3 className={mergedHeadingClassString(merged, "h3")}>{step.title}</h3>
                  <p className={merged.typography.body === "compact" ? "lp-p-sm" : "lp-p"}>{step.text}</p>
                </div>
              </div>
            </div>

            <div className="lp-zig-media">
              <div className="lp-media-card">
                {/* eslint-disable-next-line @next/next/no-img-element -- CMS zigzag image */}
                <img
                  src={step.imageSrc ?? ""}
                  alt={normalizeDisplayText(safeAltForImg(undefined, step.title)) || "Illustrasjon"}
                  className="lp-section-img"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
