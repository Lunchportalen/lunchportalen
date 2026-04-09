import { resolvePublishedImageRef } from "@/lib/cms/media/publishedAssetRef";

type Row = Record<string, unknown>;

function hasRenderableImageField(row: Row, keys: string[]) {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return true;
  }
  return false;
}

function mediaKey(row: Row): string | null {
  const a = row.imageId;
  const b = row.mediaItemId;
  if (typeof a === "string" && a.trim()) return a.trim();
  if (typeof b === "string" && b.trim()) return b.trim();
  return null;
}

function fillPublishedUrlFromId(row: Row, idKey: string, urlKey: string) {
  const existing = row[urlKey];
  if (typeof existing === "string" && existing.trim()) return;
  const id = typeof row[idKey] === "string" ? row[idKey].trim() : "";
  if (!id) return;
  const isDirectUrl = id.startsWith("/") || id.startsWith("http://") || id.startsWith("https://");
  const url = isDirectUrl ? id : resolvePublishedImageRef(id);
  if (url) row[urlKey] = url;
}

/**
 * Fill URL fields from `cms:*` registry keys only (sync). UUIDs resolve on server in {@link resolveMediaInBlockList}.
 */
export function syncResolvePublishedImagesInData(data: Record<string, unknown>): void {
  const fillRow = (row: Row, ...assignKeys: string[]) => {
    if (hasRenderableImageField(row, ["src", "imageUrl", "image", "assetPath"])) return;
    const id = mediaKey(row);
    if (!id) return;
    const isDirectUrl = id.startsWith("/") || id.startsWith("http://") || id.startsWith("https://");
    const url = isDirectUrl ? id : resolvePublishedImageRef(id);
    if (!url) return;
    for (const k of assignKeys) {
      if (row[k] == null || (typeof row[k] === "string" && !(row[k] as string).trim())) {
        row[k] = url;
      }
    }
  };

  fillRow(data, "imageUrl", "src", "assetPath");

  fillPublishedUrlFromId(data, "backgroundImageId", "backgroundImage");
  fillPublishedUrlFromId(data, "overlayImageId", "overlayImage");

  if (Array.isArray(data.steps)) {
    for (const step of data.steps) {
      if (step && typeof step === "object" && !Array.isArray(step)) {
        fillRow(step as Row, "image", "src");
      }
    }
  }

  if (Array.isArray(data.items)) {
    for (const item of data.items) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        fillRow(item as Row, "image", "src", "imageUrl", "assetPath");
      }
    }
  }
}
