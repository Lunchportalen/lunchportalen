/**
 * Media domain: single source of truth for media items.
 * - types: MediaItem, MediaItemMetadata, etc.
 * - normalize: rowToMediaItem (server)
 * - loaders: getMediaItemById (server)
 * - ids: isMediaItemUuid, isValidMediaItemId
 * - parse: parseMediaItemFromApi, parseMediaItemListFromApi (client)
 *
 * Fail-closed media: parse excludes items without valid id/url so broken media never
 * appears as valid. Picker clears list on load failure and only applies selection when
 * hasValidSelectionUrl. Preview/public use SafeCmsImage (onError → placeholder). Editor
 * shows "Bilde mangler (mediearkiv)" when mediaItemId without URL; save clears stale
 * mediaItemId (pageBuilderNormalize clearStaleMediaRef).
 */

export type {
  MediaItem,
  MediaItemMetadata,
  MediaItemSource,
  MediaItemStatus,
  MediaItemType,
  MediaUsageHint,
} from "./types";
export { rowToMediaItem, mediaItemSelectColumns } from "./normalize";
export { isMediaItemUuid, isValidMediaItemId } from "./ids";
export { parseMediaItemFromApi, parseMediaItemListFromApi } from "./parse";
export {
  validateMediaUrl,
  MEDIA_ALT_MAX,
  MEDIA_CAPTION_MAX,
  MEDIA_TAGS_MAX_COUNT,
  MEDIA_TAG_MAX_LEN,
  MEDIA_URL_MAX_LEN,
} from "./validation";
export { safeAltForImg, safeCaptionForFigcaption } from "./renderSafe";
/* Server-only: import getMediaItemById from "@/lib/media/loaders" */
