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

    if (block.type === "banners" && Array.isArray(data.bannerItems)) {
      for (const item of data.bannerItems) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          await fillRowUrls(item as MutableRecord);
        }
      }
    }

    if (block.type === "banner_carousel" && Array.isArray(data.slides)) {
      for (const item of data.slides) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          await fillRowUrls(item as MutableRecord);
        }
      }
    }

    if (block.type === "accordionOrTab" && Array.isArray(data.accordionItems)) {
      for (const item of data.accordionItems) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          await fillRowUrls(item as MutableRecord);
        }
      }
    }

    if (block.type === "accordion_tabs" && Array.isArray(data.items)) {
      for (const item of data.items) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          await fillRowUrls(item as MutableRecord);
        }
      }
    }

    if (block.type === "anchorNavigation" && Array.isArray(data.links)) {
      for (const item of data.links) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          await fillRowUrls(item as MutableRecord);
        }
      }
    }

    if (block.type === "anchor_navigation" && Array.isArray(data.links)) {
      for (const item of data.links) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          await fillRowUrls(item as MutableRecord);
        }
      }
    }

    if (block.type === "dual_promo_cards" && Array.isArray(data.cards)) {
      for (const item of data.cards) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          await fillRowUrls(item as MutableRecord);
        }
      }
    }

    if (block.type === "testimonial_block") {
      if (Array.isArray(data.testimonials)) {
        for (const item of data.testimonials) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            await fillRowUrls(item as MutableRecord);
          }
        }
      }
      if (typeof data.testimonialsJson === "string" && data.testimonialsJson.trim()) {
        try {
          const arr = JSON.parse(data.testimonialsJson) as unknown;
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item && typeof item === "object" && !Array.isArray(item)) {
                await fillRowUrls(item as MutableRecord);
              }
            }
            data.testimonialsJson = JSON.stringify(arr);
          }
        } catch {
          /* leave testimonialsJson unchanged */
        }
      }
    }

    if (block.type === "stats_block") {
      if (Array.isArray(data.kpis)) {
        for (const item of data.kpis) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            await fillRowUrls(item as MutableRecord);
          }
        }
      }
      if (typeof data.kpisJson === "string" && data.kpisJson.trim()) {
        try {
          const arr = JSON.parse(data.kpisJson) as unknown;
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item && typeof item === "object" && !Array.isArray(item)) {
                await fillRowUrls(item as MutableRecord);
              }
            }
            data.kpisJson = JSON.stringify(arr);
          }
        } catch {
          /* leave kpisJson unchanged */
        }
      }
    }

    if (block.type === "logo_cloud") {
      for (const n of [1, 2, 3, 4] as const) {
        const k = `l${n}`;
        await fillUrlFromDedicatedId(data, k, k);
      }
      if (Array.isArray(data.logos)) {
        for (const item of data.logos) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            await fillRowUrls(item as MutableRecord);
          }
        }
      }
      if (typeof data.logosJson === "string" && data.logosJson.trim()) {
        try {
          const arr = JSON.parse(data.logosJson) as unknown;
          if (Array.isArray(arr)) {
            for (const item of arr) {
              if (item && typeof item === "object" && !Array.isArray(item)) {
                await fillRowUrls(item as MutableRecord);
              }
            }
            data.logosJson = JSON.stringify(arr);
          }
        } catch {
          /* leave logosJson unchanged */
        }
      }
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
