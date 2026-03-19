import "server-only";

import { rowToMediaItem, mediaItemSelectColumns } from "./normalize";
import type { MediaItem } from "./types";
import { isMediaItemUuid } from "./ids";

/**
 * Load a single media item by id. Returns null if not found or id invalid.
 * Use for GET [id] and any server-side resolution. Deterministic.
 */
export async function getMediaItemById(id: string): Promise<MediaItem | null> {
  if (!isMediaItemUuid(id)) return null;
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("media_items")
    .select(mediaItemSelectColumns)
    .eq("id", id.trim())
    .maybeSingle();
  if (error || !data) return null;
  return rowToMediaItem(data as Record<string, unknown>);
}
