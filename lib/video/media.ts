/**
 * CMS-media for kort video (bilder + eventuelle video-URL-er fra biblioteket).
 */

import "server-only";

import type { MediaItem } from "@/lib/media/types";
import { getReadyMediaItemsForProduct } from "@/lib/social/mediaAdapter";

function isVideoAsset(url: string, mime: string | null | undefined): boolean {
  const m = (mime ?? "").toLowerCase();
  if (m.startsWith("video/")) return true;
  const u = url.trim();
  return /\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(u);
}

function urlFromItem(it: MediaItem): string | null {
  const u = it.url?.trim();
  return u && u.length > 0 ? u : null;
}

export async function getMediaAssets(productId: string): Promise<{ images: string[]; videos: string[] }> {
  const items = await getReadyMediaItemsForProduct(productId);
  const images: string[] = [];
  const videos: string[] = [];
  for (const it of items) {
    const u = urlFromItem(it);
    if (!u) continue;
    if (isVideoAsset(u, it.mime_type)) videos.push(u);
    else images.push(u);
  }
  return {
    images: [...new Set(images)].slice(0, 12),
    videos: [...new Set(videos)].slice(0, 6),
  };
}
