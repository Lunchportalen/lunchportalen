import "server-only";

import { resolveMedia } from "@/lib/cms/media/resolveMedia";
import type { BlockNode } from "@/lib/cms/model/blockTypes";

type MutableRecord = Record<string, unknown>;

const URL_KEYS = ["image", "src", "imageUrl", "assetPath"] as const;

function mediaIdFromRow(row: MutableRecord): string | null {
  const a = row.imageId;
  const b = row.mediaItemId;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (typeof b === "string" && b.trim()) return b.trim();
  return null;
}

function hasRenderableUrl(row: MutableRecord) {
  for (const k of URL_KEYS) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return true;
  }
  return false;
}

function variantKeyFromRow(row: MutableRecord): string | undefined {
  const v = row.mediaVariantKey;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

async function fillRowUrls(row: MutableRecord) {
  if (hasRenderableUrl(row)) return;
  const mid = mediaIdFromRow(row);
  if (!mid) return;
  if (mid.startsWith("http://") || mid.startsWith("https://") || mid.startsWith("/")) {
    for (const k of URL_KEYS) {
      const cur = row[k];
      if (cur == null || (typeof cur === "string" && !cur.trim())) row[k] = mid;
    }
    return;
  }
  const vk = variantKeyFromRow(row);
  const url = await resolveMedia(mid, vk ? { variantKey: vk } : undefined);
  if (!url) return;
  for (const k of URL_KEYS) {
    const cur = row[k];
    if (cur == null || (typeof cur === "string" && !cur.trim())) row[k] = url;
  }
}

async function fillUrlFromDedicatedId(row: MutableRecord, idKey: string, urlKey: string) {
  const existing = row[urlKey];
  if (typeof existing === "string" && existing.trim()) return;
  const raw = row[idKey];
  const mid = typeof raw === "string" ? raw.trim() : "";
  if (!mid) return;
  if (mid.startsWith("http://") || mid.startsWith("https://") || mid.startsWith("/")) {
    row[urlKey] = mid;
    return;
  }
  const vk = variantKeyFromRow(row);
  const url = await resolveMedia(mid, vk ? { variantKey: vk } : undefined);
  if (url) row[urlKey] = url;
}

/**
 * Deep-clone normalized blocks and fill image URLs from `imageId` / `mediaItemId` via {@link resolveMedia}.
 * Preserves existing URL fields when already set.
 */
export async function resolveMediaInNormalizedBlocks(blocks: BlockNode[]): Promise<BlockNode[]> {
  const raw = JSON.parse(JSON.stringify(blocks)) as BlockNode[];

  for (const block of raw) {
    if (!block || typeof block !== "object") continue;
    const data =
      block.data != null && typeof block.data === "object" && !Array.isArray(block.data)
        ? (block.data as MutableRecord)
        : null;
    if (!data) continue;

    if (block.type === "hero_bleed") {
      await fillUrlFromDedicatedId(data, "backgroundImageId", "backgroundImage");
      await fillUrlFromDedicatedId(data, "overlayImageId", "overlayImage");
    }

    if (block.type === "banner") {
      await fillUrlFromDedicatedId(data, "backgroundImageId", "backgroundImage");
    }

    await fillRowUrls(data);

    if (Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (step && typeof step === "object" && !Array.isArray(step)) {
          await fillRowUrls(step as MutableRecord);
        }
      }
    }

    if (Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          await fillRowUrls(item as MutableRecord);
        }
      }
    }
  }

  return raw;
}
