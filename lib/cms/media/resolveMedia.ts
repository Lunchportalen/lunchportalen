import "server-only";

import { getMediaItemById } from "@/lib/media/loaders";
import { isMediaItemUuid } from "@/lib/media/ids";
import { pickResolvedUrlFromMetadata } from "@/lib/media/variantResolution";
import { resolvePublishedImageRef } from "@/lib/cms/media/publishedAssetRef";

export type ResolveMediaOptions = {
  /** If set, use metadata.variants[key] when valid https URL; else primary url. */
  variantKey?: string;
};

/**
 * Resolve a CMS image reference to a display URL.
 * Order: media_items (UUID) → published editorial registry (`cms:*` keys).
 * Optional variantKey selects metadata.variants[key] when present.
 */
export async function resolveMedia(
  imageId: string | null | undefined,
  opts?: ResolveMediaOptions
): Promise<string | null> {
  if (typeof imageId !== "string" || !imageId.trim()) return null;
  const id = imageId.trim();
  if (id.startsWith("http://") || id.startsWith("https://") || id.startsWith("/")) return id;
  const fromRegistry = resolvePublishedImageRef(id);
  if (fromRegistry) return fromRegistry;
  if (!isMediaItemUuid(id)) return null;
  const item = await getMediaItemById(id);
  if (!item?.url?.trim()) return null;
  const primary = item.url.trim();
  return pickResolvedUrlFromMetadata(primary, item.metadata, opts?.variantKey);
}
