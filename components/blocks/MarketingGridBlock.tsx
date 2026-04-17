import React from "react";
import { Section } from "@/components/ui/Section";
import type { MergedDesign } from "@/lib/cms/design/designContract";
import {
  marketingContainerClassString,
  marketingSectionClassString,
  mergedHeadingClassString,
} from "@/lib/cms/design/designContract";
import { safeAltForImg } from "@/lib/media/renderSafe";

export type MarketingGridItem = {
  title: string;
  imageSrc: string | null;
};

export type MarketingGridBlockProps = {
  merged: MergedDesign;
  title: string;
  headAlign: string;
  items: MarketingGridItem[];
  /** Locked column rhythm on md+ (default 3 to match legacy `.lp-local-grid`). */
  columnMode?: "2" | "3";
};

/**
 * Locked local media grid (`grid`).
 */
export function MarketingGridBlock({ merged, title, headAlign, items, columnMode = "3" }: MarketingGridBlockProps) {
  const gridClass =
    columnMode === "2" ? "lp-local-grid lp-local-grid-cols-2" : "lp-local-grid";

  return (
    <Section sectionClassName={marketingSectionClassString(merged)} containerClassName={marketingContainerClassString(merged)}>
      <div className={`lp-section-head ${headAlign}`}>
        <h2 className={mergedHeadingClassString(merged, "h2")}>{title}</h2>
      </div>

      <div className={gridClass}>
        {items.map((item, i) => (
          <div key={i} className="lp-local-card">
            {/* eslint-disable-next-line @next/next/no-img-element -- CMS grid image */}
            <img
              src={item.imageSrc ?? ""}
              alt={safeAltForImg(undefined, item.title) || "Bilde"}
              className="lp-section-img"
            />
            <div className="lp-local-meta">
              <div className="lp-local-h">{item.title}</div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
