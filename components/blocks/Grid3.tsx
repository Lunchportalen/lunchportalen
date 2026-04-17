import React from "react";
import type { MarketingGridBlockProps } from "./MarketingGridBlock";
import { MarketingGridBlock } from "./MarketingGridBlock";

/**
 * Locked 3-up grid (`grid` default).
 */
export function Grid3(props: Omit<MarketingGridBlockProps, "columnMode">) {
  return <MarketingGridBlock {...props} columnMode="3" />;
}

export type { MarketingGridItem } from "./MarketingGridBlock";
