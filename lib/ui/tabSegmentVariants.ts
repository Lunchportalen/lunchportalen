/**
 * LUNCHPORTALEN — Tab and segmented control visual variants (primitives from lib/ui/motion.css).
 * Wired to Tabs (components/ui/tabs.tsx). Tabs: role=tab, aria-selected. Segments: aria-pressed for selected.
 * Selected/active states must remain unmistakable.
 */

export type TabSegmentVariant = "glass" | "soft" | "gradient" | "outline" | "glow";

/** Map variant to lp-tab-* class (tab trigger; use with aria-selected) */
export const tabVariantClasses: Record<TabSegmentVariant, string> = {
  glass: "lp-tab-glass",
  soft: "lp-tab-soft",
  gradient: "lp-tab-gradient",
  outline: "lp-tab-outline",
  glow: "lp-tab-glow",
};

/** Map variant to lp-tab-list-* class (optional TabsList wrapper) */
export const tabListVariantClasses: Record<TabSegmentVariant, string> = {
  glass: "lp-tab-list-glass",
  soft: "lp-tab-list-soft",
  gradient: "lp-tab-list-gradient",
  outline: "lp-tab-list-outline",
  glow: "lp-tab-list-glow",
};

/** Map variant to lp-segment-* class (segmented control container; children use aria-pressed) */
export const segmentVariantClasses: Record<TabSegmentVariant, string> = {
  glass: "lp-segment-glass",
  soft: "lp-segment-soft",
  gradient: "lp-segment-gradient",
  outline: "lp-segment-outline",
  glow: "lp-segment-glow",
};

export function getTabVariantClass(variant: TabSegmentVariant | undefined): string {
  return variant ? tabVariantClasses[variant] : tabVariantClasses.soft;
}

export function getTabListVariantClass(variant: TabSegmentVariant | undefined): string {
  return variant ? tabListVariantClasses[variant] : tabListVariantClasses.soft;
}

export function getSegmentVariantClass(variant: TabSegmentVariant | undefined): string {
  return variant ? segmentVariantClasses[variant] : segmentVariantClasses.soft;
}
