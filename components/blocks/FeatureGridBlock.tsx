import React from "react";
import type { MarketingCardItem, MarketingCardsBlockProps } from "@/components/blocks/MarketingCardsBlock";
import { MarketingCardsBlock } from "@/components/blocks/MarketingCardsBlock";

export type FeatureGridBlockProps = Omit<MarketingCardsBlockProps, "featurePresentation">;

/**
 * Feature grid: same locked surface as cards, with system-owned “icon” rings.
 */
export function FeatureGridBlock(props: FeatureGridBlockProps) {
  return <MarketingCardsBlock {...props} featurePresentation />;
}

export type { MarketingCardItem as FeatureGridItem };
