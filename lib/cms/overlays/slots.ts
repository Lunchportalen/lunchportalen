/**
 * App overlay CMS: fixed slot ids.
 */
export type OverlaySlotId =
  | "topBanner"
  | "header"
  | "help"
  | "emptyState"
  | "sidebar"
  | "footerCta";

export const OVERLAY_SLOT_IDS: OverlaySlotId[] = [
  "topBanner", "header", "help", "emptyState", "sidebar", "footerCta",
];

export const OVERLAY_ALLOWED_BLOCK_TYPES = ["hero", "richText", "cta", "image", "form"] as const;
export type OverlayBlockType = (typeof OVERLAY_ALLOWED_BLOCK_TYPES)[number];

export function isOverlaySlotId(value: unknown): value is OverlaySlotId {
  return typeof value === "string" && OVERLAY_SLOT_IDS.includes(value as OverlaySlotId);
}

export function isAllowedOverlayBlockType(type: string): type is OverlayBlockType {
  return OVERLAY_ALLOWED_BLOCK_TYPES.includes(type as OverlayBlockType);
}
