/**
 * CMS Media Library adapter — leser `media_items` via Supabase admin (samme kolonner som API).
 * Deterministisk valg: tag-match på produkt-id, ellers stabil hash-indeks i ready-pool.
 */

import "server-only";

import type { MediaItem } from "@/lib/media/types";
import { mediaItemSelectColumns, rowToMediaItem } from "@/lib/media/normalize";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { CalendarPost, SocialMediaAttachment } from "@/lib/social/calendar";
import type { SocialEngineMediaPayload } from "@/lib/social/enginePayload";

const READY_POOL_LIMIT = 120;

function seedHash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickFromPool(productId: string, items: MediaItem[]): SocialEngineMediaPayload {
  if (items.length === 0) {
    return { imageUrl: null, mediaItemId: null };
  }

  const tagged = items.filter((m) =>
    m.tags.some((t) => t === productId || t === `social:${productId}` || t.includes(`product:${productId}`)),
  );
  const pool = tagged.length > 0 ? tagged : items;
  const idx = seedHash(productId) % pool.length;
  const pick = pool[idx];
  if (!pick) {
    return { imageUrl: null, mediaItemId: null };
  }

  return {
    imageUrl: pick.url,
    alt: pick.alt || undefined,
    source: pick.source,
    mediaItemId: pick.id,
  };
}

async function loadReadyMediaPool(): Promise<MediaItem[]> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("media_items")
      .select(mediaItemSelectColumns)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(READY_POOL_LIMIT);

    if (error || !Array.isArray(data)) {
      return [];
    }

    return data
      .map((row) => rowToMediaItem(row as Record<string, unknown>))
      .filter((item): item is MediaItem => item != null);
  } catch {
    return [];
  }
}

/**
 * Velg ett CMS-bilde for produkt (tag-link eller deterministisk rotasjon i ready-listen).
 */
export async function getMediaForProduct(productId: string): Promise<SocialEngineMediaPayload> {
  const id = String(productId ?? "").trim();
  if (!id) {
    return { imageUrl: null, mediaItemId: null };
  }
  const pool = await loadReadyMediaPool();
  return pickFromPool(id, pool);
}

/**
 * Alle «ready» CMS-media for produkt (tag-match, ellers del av global pool) — brukes av video-motor m.m.
 */
export async function getReadyMediaItemsForProduct(productId: string): Promise<MediaItem[]> {
  const id = String(productId ?? "").trim();
  if (!id) return [];
  const pool = await loadReadyMediaPool();
  const tagged = pool.filter((m) =>
    m.tags.some((t) => t === id || t === `social:${id}` || t.includes(`product:${id}`)),
  );
  const usePool = tagged.length > 0 ? tagged : pool;
  return usePool.slice(0, 40);
}

function toAttachment(ref: SocialEngineMediaPayload): SocialMediaAttachment {
  return {
    itemId: ref.mediaItemId,
    imageUrl: ref.imageUrl,
    alt: ref.alt,
    source: ref.source,
  };
}

/**
 * Batch: én DB-runde, deretter lokal kobling per post (ingen N+1).
 */
export async function enrichCalendarPostsWithMedia(posts: CalendarPost[]): Promise<CalendarPost[]> {
  const pool = await loadReadyMediaPool();
  return posts.map((p) => ({
    ...p,
    socialMedia: toAttachment(pickFromPool(p.productId, pool)),
  }));
}
