/**
 * Published CMS image registry: logical keys → public URL path.
 * Block `data` stores `imageId` (or `mediaItemId` UUID); paths live here or in media_items — never duplicated in blocks.
 *
 * Prefix `cms:` = stable editorial keys for seed / AI. UUIDs skip this map and resolve via DB.
 */

export const CMS_PUBLISHED_IMAGE_REF: Record<string, string> = {
  "cms:zigzag-step-1": "/matbilder/MelhusCatering-Lunsj-1017985.jpg",
  "cms:zigzag-step-2": "/matbilder/MelhusCatering-Lunsj-1018001.jpg",
  "cms:zigzag-step-3": "/matbilder/MelhusCatering-Lunsj-1018019.jpg",
  "cms:grid-customers": "/matbilder/MelhusCatering-Lunsj-1018047.jpg",
  "cms:grid-cities": "/matbilder/MelhusCatering-Lunsj-1018059.jpg",
  "cms:grid-deliveries": "/matbilder/MelhusCatering-Lunsj-1018064.jpg",
};

/**
 * Synchronous resolution for client preview and normalize pass (registry keys only).
 */
export function resolvePublishedImageRef(imageId: string | null | undefined): string | null {
  if (typeof imageId !== "string" || !imageId.trim()) return null;
  const key = imageId.trim();
  const path = CMS_PUBLISHED_IMAGE_REF[key];
  return typeof path === "string" && path.length > 0 ? path : null;
}
