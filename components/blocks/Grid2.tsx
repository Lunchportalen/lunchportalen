import React from "react";
import type { MarketingGridBlockProps } from "./MarketingGridBlock";
import { MarketingGridBlock } from "./MarketingGridBlock";

/**
 * Locked 2-up grid (`grid` on md+).
 */
export function Grid2(props: Omit<MarketingGridBlockProps, "columnMode">) {
  return <MarketingGridBlock {...props} columnMode="2" />;
}

export type { MarketingGridItem } from "./MarketingGridBlock";
